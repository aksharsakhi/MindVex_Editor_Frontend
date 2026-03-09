import type { TreeSitterParser, SupportedLanguage, ParseResult } from './treeSitterParser';
import { AIClient } from './aiClient';
import { z } from 'zod';

// Parse mode configuration
export interface ParseMode {
  type: 'parser-only' | 'llm-enhanced';
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

// LLM Analysis result
export interface LLMAnalysis {
  summary: string;
  patterns: CodePattern[];
  recommendations: string[];
  complexity: {
    score: number;
    factors: string[];
  };
  architecture: {
    type: string;
    patterns: string[];
    issues: string[];
  };
  quality: {
    score: number;
    issues: string[];
    strengths: string[];
  };
  graph?: {
    nodes: Array<{ id: string; label: string; type: string }>;
    edges: Array<{ source: string; target: string; type: string; strength?: number }>;
  };
}

export interface CodePattern {
  type: string;
  name: string;
  line: number;
  description: string;
  severity: 'info' | 'warning' | 'error';
}

// Enhanced parse result with LLM analysis
export interface EnhancedParseResult extends ParseResult {
  llmAnalysis?: LLMAnalysis;
  analysisTime?: number;
}

// Project analysis result
export interface ProjectAnalysis {
  files: EnhancedParseResult[];
  projectMetadata: {
    totalFiles: number;
    totalLines: number;
    totalFunctions: number;
    totalClasses: number;
    languages: Record<SupportedLanguage, number>;
    dependencies: string[];
    complexity: {
      average: number;
      highest: number;
      lowest: number;
    };
  };
  llmAnalysis?: LLMAnalysis;
}

// Zod schemas for LLM analysis
const codePatternSchema = z.object({
  type: z.string(),
  name: z.string(),
  line: z.number(),
  description: z.string(),
  severity: z.enum(['info', 'warning', 'error']),
});

const llmAnalysisSchema = z.object({
  summary: z.string(),
  patterns: z.array(codePatternSchema),
  recommendations: z.array(z.string()),
  complexity: z.object({
    score: z.number(),
    factors: z.array(z.string()),
  }),
  architecture: z.object({
    type: z.string(),
    patterns: z.array(z.string()),
    issues: z.array(z.string()),
  }),
  quality: z.object({
    score: z.number(),
    issues: z.array(z.string()),
    strengths: z.array(z.string()),
  }),
  graph: z
    .object({
      nodes: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          type: z.string(),
        }),
      ),
      edges: z.array(
        z.object({
          source: z.string(),
          target: z.string(),
          type: z.string(),
          strength: z.number().optional(),
        }),
      ),
    })
    .optional(),
});

export class UnifiedParserService {
  private _parser: TreeSitterParser;
  private _mode: ParseMode = { type: 'parser-only' };
  private _aiClient: AIClient;

  constructor(parser: TreeSitterParser) {
    this._parser = parser;
    this._aiClient = new AIClient();
  }

  setMode(mode: ParseMode): void {
    this._mode = mode;
  }

  getMode(): ParseMode {
    return this._mode;
  }

  async parseCode(code: string, filePath: string): Promise<EnhancedParseResult> {
    const language = this._parser.getLanguageFromExtension(filePath);

    if (!language) {
      throw new Error(`Unsupported file type: ${filePath}`);
    }

    const analysisStartTime = Date.now();

    // Parse with tree-sitter
    const parseResult = await this._parser.parse(code, language, filePath);

    let llmAnalysis: LLMAnalysis | undefined;

    // Perform LLM analysis if in LLM-enhanced mode
    if (this._mode.type === 'llm-enhanced') {
      llmAnalysis = await this._performLLMAnalysis(code, parseResult.metadata, filePath, language);
    }

    const analysisTime = Date.now() - analysisStartTime;

    return {
      ...parseResult,
      llmAnalysis,
      analysisTime,
    };
  }

  async parseProject(files: Array<{ path: string; content: string }>): Promise<ProjectAnalysis> {
    const results: EnhancedParseResult[] = [];

    // Parse all files
    for (const file of files) {
      try {
        const result = await this.parseCode(file.content, file.path);
        results.push(result);
      } catch (error) {
        console.error(`Failed to parse ${file.path}:`, error);
      }
    }

    // Calculate project metadata
    const projectMetadata = this._calculateProjectMetadata(results);

    let llmAnalysis: LLMAnalysis | undefined;

    // Perform project-level LLM analysis if in LLM-enhanced mode
    if (this._mode.type === 'llm-enhanced') {
      llmAnalysis = await this._performProjectLLMAnalysis(results, projectMetadata);
    }

    return {
      files: results,
      projectMetadata,
      llmAnalysis,
    };
  }

  private _calculateProjectMetadata(results: EnhancedParseResult[]): ProjectAnalysis['projectMetadata'] {
    const languages: Record<SupportedLanguage, number> = {} as Record<SupportedLanguage, number>;
    let totalLines = 0;
    let totalFunctions = 0;
    let totalClasses = 0;
    const complexities: number[] = [];
    const dependencies = new Set<string>();

    results.forEach((result) => {
      // Count languages
      languages[result.language] = (languages[result.language] || 0) + 1;

      // Count lines and code elements
      totalLines += result.metadata.linesOfCode;
      totalFunctions += result.metadata.functions.length;
      totalClasses += result.metadata.classes.length;

      // Collect complexity scores
      result.metadata.functions.forEach((func) => {
        complexities.push(func.complexity);
      });

      // Collect dependencies
      result.metadata.imports.forEach((imp) => {
        dependencies.add(imp.module);
      });
    });

    const complexityValues = complexities.length > 0 ? complexities : [0];

    return {
      totalFiles: results.length,
      totalLines,
      totalFunctions,
      totalClasses,
      languages,
      dependencies: Array.from(dependencies),
      complexity: {
        average: complexityValues.reduce((a, b) => a + b, 0) / complexityValues.length,
        highest: Math.max(...complexityValues),
        lowest: Math.min(...complexityValues),
      },
    };
  }

  private async _performLLMAnalysis(
    code: string,
    metadata: ParseResult['metadata'],
    filePath: string,
    language: string,
  ): Promise<LLMAnalysis> {
    if (this._mode.type !== 'llm-enhanced') {
      throw new Error('LLM analysis not available in parser-only mode');
    }

    try {
      const context = `File: ${filePath}
Language: ${language}
Functions: ${metadata.functions.length}
Classes: ${metadata.classes.length}
Imports: ${metadata.imports.length}
Lines: ${metadata.linesOfCode}`;

      const system = `You are an expert code analyzer. Your task is to analyze the provided code and metadata and return a JSON object that matches this schema:
{
  "summary": "string",
  "patterns": [{ "type": "string", "name": "string", "line": number, "description": "string", "severity": "info" | "warning" | "error" }],
  "recommendations": ["string"],
  "complexity": { "score": number, "factors": ["string"] },
  "architecture": { "type": "string", "patterns": ["string"], "issues": ["string"] },
  "quality": { "score": number, "issues": ["string"], "strengths": ["string"] }
}
Only return the JSON object, no other text.`;

      const response = await this._aiClient.analyzeCode(code, context, {
        system,
        model: this._mode.model,
        temperature: this._mode.temperature,
        maxTokens: this._mode.maxTokens,
      });

      try {
        // Clean the response text to extract only JSON
        const jsonMatch = response.text.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0]);
          return llmAnalysisSchema.parse(analysis);
        }

        throw new Error('No JSON found in AI response');
      } catch (_err) {
        console.warn('AI response parsing failed, using mock data:', _err);
        return this._generateMockLLMAnalysis(code, metadata, filePath);
      }
    } catch (error) {
      console.error('LLM analysis failed:', error);
      return this._generateFallbackLLMAnalysis(metadata);
    }
  }

  private async _performProjectLLMAnalysis(
    results: EnhancedParseResult[],
    projectMetadata: ProjectAnalysis['projectMetadata'],
  ): Promise<LLMAnalysis> {
    if (this._mode.type !== 'llm-enhanced') {
      throw new Error('LLM analysis not available in parser-only mode');
    }

    try {
      const fileList = results.map((r) => r.filePath).join('\n');

      // Extract relationships found by AST parser to guide the LLM
      const astRelationships = results
        .flatMap((r) =>
          r.metadata.imports.map((imp) => {
            const target = results.find((f) => f.filePath.includes(imp.module) || imp.module.includes(f.filePath));
            return target ? `${r.filePath} -> ${target.filePath} (${imp.symbols.join(', ')})` : null;
          }),
        )
        .filter(Boolean)
        .join('\n');

      const context = `Project Summary:
Files: ${projectMetadata.totalFiles}
Total Lines: ${projectMetadata.totalLines}
Functions: ${projectMetadata.totalFunctions}
Classes: ${projectMetadata.totalClasses}
Languages: ${Object.keys(projectMetadata.languages).join(', ')}
Dependencies: ${projectMetadata.dependencies.length}

File List:
${fileList}

Detected AST Relationships:
${astRelationships || 'None detected yet'}

TASK:
1. Provide an architectural summary.
2. Identify design patterns.
3. CRITICAL: Generate a JSON "graph" object representing the REAL dependencies between these files. 
   - Use the Detected AST Relationships as a baseline, but enhance them with your semantic understanding (e.g., if a controller uses a service via dependency injection that wasn't caught by simple import parsing).
   - Each node MUST be one of the files in the File List.
   - Each edge MUST have a valid "source" and "target" from the File List.
   - Do not invent files. Use the full paths provided.`;

      const system = `You are a senior software architect.

Return ONLY valid JSON.

Do NOT include explanations.
Do NOT include markdown.
Do NOT include text outside JSON.
Do NOT wrap in backticks.

Output format:

{
  "summary": "High-level architectural summary...",
  "patterns": [],
  "recommendations": [],
  "complexity": { "score": 0, "factors": [] },
  "architecture": { "type": "", "patterns": [], "issues": [] },
  "quality": { "score": 0, "issues": [], "strengths": [] },
  "graph": {
    "nodes": [
      {
        "id": "src/services/AuthService.ts",
        "label": "Auth Service",
        "type": "service",
        "layer": "backend"
      }
    ],
    "edges": [
      {
        "source": "src/client/App.tsx",
        "target": "src/services/AuthService.ts",
        "type": "dependency",
        "strength": 1
      }
    ]
  }
}

Rules:
- Group related files into logical services
- Allowed layers:
  frontend
  backend
  data
  external
  infrastructure
- Use exact file paths for node IDs
- If unsure, infer logical architecture
- Must always return nodes and edges arrays inside graph object
`;

      console.log('Sending AI request...');

      const response = await this._aiClient.generate({
        prompt: context,
        system,
        model: this._mode.model,
        temperature: 0, // Strict deterministic output
        maxTokens: this._mode.maxTokens,
      });

      console.log('RAW AI RESPONSE:', response.text);

      try {
        // Clean the response text to extract only JSON
        let jsonStr = response.text.trim();

        // Try to extract from code blocks first
        if (jsonStr.includes('```json')) {
          jsonStr = jsonStr.split('```json')[1].split('```')[0].trim();
        } else if (jsonStr.includes('```')) {
          jsonStr = jsonStr.split('```')[1].split('```')[0].trim();
        } else {
          // If no code blocks, try to find the JSON object directly
          const firstBrace = jsonStr.indexOf('{');
          const lastBrace = jsonStr.lastIndexOf('}');

          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
          }
        }

        let parsed;

        try {
          parsed = JSON.parse(jsonStr);
        } catch (err) {
          console.error('AI JSON parsing failed:', response.text);
          return this._generateMockProjectLLMAnalysis(results, projectMetadata);
        }

        if (!parsed.graph || !parsed.graph.nodes || !parsed.graph.edges) {
          console.error('AI returned invalid structure:', parsed);
          return this._generateMockProjectLLMAnalysis(results, projectMetadata);
        }

        console.log('Parsed AI Analysis:', parsed);

        /*
         * Ensure validation doesn't fail on missing optional fields if any
         * We might need to map it to match LLMAnalysisSchema strictness or loosen schema
         * For now, assuming schema matches output format
         */

        const validated = llmAnalysisSchema.parse(parsed);
        console.log('Validated AI Analysis:', validated);

        return validated;
      } catch (e) {
        console.error('Project AI response parsing failed:', e, 'Response was:', response.text);
        return this._generateMockProjectLLMAnalysis(results, projectMetadata);
      }
    } catch (error) {
      console.error('Project LLM analysis failed:', error);

      // Fallback to AST-based graph generation so the user always sees a graph
      return this._generateMockProjectLLMAnalysis(results, projectMetadata);
    }
  }

  private _generateMockLLMAnalysis(code: string, metadata: ParseResult['metadata'], filePath: string): LLMAnalysis {
    const complexityScore = Math.min(
      100,
      (metadata.functions.reduce((sum, func) => sum + func.complexity, 0) / Math.max(1, metadata.functions.length)) *
        10,
    );

    return {
      summary: `Analysis of ${filePath} reveals a ${metadata.functions.length > 0 ? 'well-structured' : 'simple'} codebase with ${metadata.functions.length} functions and ${metadata.classes.length} classes.`,
      patterns: [
        {
          type: 'structure',
          name: 'Function Organization',
          line: 1,
          description: `File contains ${metadata.functions.length} functions with average complexity ${complexityScore.toFixed(1)}`,
          severity: complexityScore > 50 ? 'warning' : 'info',
        },
      ],
      recommendations: [
        'Consider adding more documentation to complex functions',
        'Review function complexity and consider refactoring if above 10',
      ],
      complexity: {
        score: complexityScore,
        factors: [
          `Average function complexity: ${complexityScore.toFixed(1)}`,
          `Total functions: ${metadata.functions.length}`,
          `Lines of code: ${metadata.linesOfCode}`,
        ],
      },
      architecture: {
        type: metadata.classes.length > 0 ? 'Object-oriented' : 'Procedural',
        patterns: metadata.classes.length > 0 ? ['Class-based design'] : ['Function-based design'],
        issues: complexityScore > 50 ? ['High complexity detected'] : [],
      },
      quality: {
        score: Math.max(0, 100 - complexityScore),
        issues: complexityScore > 50 ? ['Complex functions may need refactoring'] : [],
        strengths: [
          `Well-organized with ${metadata.imports.length} imports`,
          `${metadata.commentLines} lines of comments`,
        ],
      },
    };
  }

  private _generateMockProjectLLMAnalysis(
    results: EnhancedParseResult[],
    projectMetadata: ProjectAnalysis['projectMetadata'],
  ): LLMAnalysis {
    const complexityScore = projectMetadata.complexity.average * 10;
    const languageCount = Object.keys(projectMetadata.languages).length;

    // Generate graph nodes and edges from AST results
    const nodes: { id: string; label: string; type: string }[] = [];
    const edges: { source: string; target: string; type: string; strength: number }[] = [];
    const nodeSet = new Set<string>();

    results.forEach((file) => {
      // Add file node
      if (!nodeSet.has(file.filePath)) {
        nodes.push({
          id: file.filePath,
          label: file.filePath.split('/').pop() || file.filePath,
          type: 'file',
        });
        nodeSet.add(file.filePath);
      }

      // Add edges from imports
      file.metadata.imports.forEach((imp) => {
        // Simple resolution strategy: look for file path ending with module name
        const target = results.find((f) => f.filePath.includes(imp.module) || imp.module.includes(f.filePath));

        if (target) {
          edges.push({
            source: file.filePath,
            target: target.filePath,
            type: 'import',
            strength: 1,
          });
        }
      });
    });

    return {
      summary: `Project analysis shows ${projectMetadata.totalFiles} files across ${languageCount} languages with ${projectMetadata.totalFunctions} functions and ${projectMetadata.totalClasses} classes.`,
      patterns: [
        {
          type: 'project',
          name: 'Multi-language Support',
          line: 1,
          description: `Project uses ${languageCount} different programming languages`,
          severity: 'info',
        },
      ],
      recommendations: [
        'Consider standardizing coding patterns across languages',
        'Review dependency usage and consider consolidation',
      ],
      complexity: {
        score: complexityScore,
        factors: [
          `Average complexity: ${projectMetadata.complexity.average.toFixed(1)}`,
          `Total functions: ${projectMetadata.totalFunctions}`,
          `Total lines: ${projectMetadata.totalLines}`,
        ],
      },
      architecture: {
        type: projectMetadata.totalClasses > projectMetadata.totalFunctions / 2 ? 'Object-oriented' : 'Mixed',
        patterns: projectMetadata.totalClasses > 0 ? ['Class-based components'] : ['Function-based modules'],
        issues: complexityScore > 50 ? ['High average complexity'] : [],
      },
      quality: {
        score: Math.max(0, 100 - complexityScore),
        issues: complexityScore > 50 ? ['Consider refactoring complex functions'] : [],
        strengths: [
          `Multi-language support with ${languageCount} languages`,
          `${projectMetadata.totalFiles} files analyzed`,
        ],
      },
      graph: {
        nodes,
        edges,
      },
    };
  }

  private _generateFallbackLLMAnalysis(_metadata: ParseResult['metadata']): LLMAnalysis {
    return {
      summary: 'Basic code analysis completed',
      patterns: [],
      recommendations: ['Enable LLM mode for detailed analysis'],
      complexity: {
        score: 0,
        factors: ['LLM analysis not available'],
      },
      architecture: {
        type: 'Unknown',
        patterns: [],
        issues: ['LLM analysis disabled'],
      },
      quality: {
        score: 0,
        issues: ['LLM analysis not performed'],
        strengths: ['Basic parsing completed successfully'],
      },
    };
  }

  private _generateFallbackProjectLLMAnalysis(projectMetadata: ProjectAnalysis['projectMetadata']): LLMAnalysis {
    return {
      summary: 'Project analysis completed with basic parsing',
      patterns: [],
      recommendations: ['Enable LLM mode for detailed project analysis'],
      complexity: {
        score: 0,
        factors: ['Project-level LLM analysis not available'],
      },
      architecture: {
        type: 'Unknown',
        patterns: [],
        issues: ['LLM analysis disabled'],
      },
      quality: {
        score: 0,
        issues: ['Project-level LLM analysis not performed'],
        strengths: [`${projectMetadata.totalFiles} files parsed successfully`],
      },
    };
  }

  getSupportedLanguages(): SupportedLanguage[] {
    return this._parser.getSupportedLanguages();
  }

  isLanguageSupported(language: string): language is SupportedLanguage {
    return this._parser.isLanguageSupported(language);
  }
}

let unifiedParserService: UnifiedParserService | null = null;

export async function getUnifiedParser(): Promise<UnifiedParserService> {
  if (!unifiedParserService) {
    const { getTreeSitterParser } = await import('./treeSitterParser');
    const parser = await getTreeSitterParser();
    unifiedParserService = new UnifiedParserService(parser);
  }

  return unifiedParserService;
}
