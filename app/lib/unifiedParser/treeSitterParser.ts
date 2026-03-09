// Enhanced Tree-sitter parser for multiple programming languages
export type SupportedLanguage =
  | 'java'
  | 'python'
  | 'typescript'
  | 'javascript'
  | 'c'
  | 'cpp'
  | 'go'
  | 'rust'
  | 'html'
  | 'css'
  | 'json'
  | 'yaml'
  | 'markdown'
  | 'php'
  | 'ruby'
  | 'swift'
  | 'kotlin'
  | 'dart'
  | 'lua'
  | 'shell'
  | 'sql'
  | 'xml'
  | 'dockerfile'
  | 'makefile'
  | 'cmake'
  | 'toml'
  | 'ini'
  | 'perl'
  | 'r'
  | 'julia'
  | 'elixir'
  | 'clojure'
  | 'haskell'
  | 'scala'
  | 'erlang'
  | 'fsharp'
  | 'ocaml'
  | 'scheme'
  | 'lisp'
  | 'fortran'
  | 'matlab'
  | 'vba'
  | 'powershell'
  | 'vim'
  | 'latex'
  | 'bibtex'
  | 'graphql'
  | 'proto'
  | 'thrift'
  | 'capnp'
  | 'asn1'
  | 'regex'
  | 'diff'
  | 'gitcommit'
  | 'gitrebase'
  | 'gitattributes'
  | 'gitignore'
  | 'dockerignore'
  | 'editorconfig'
  | 'eslintignore'
  | 'prettierignore'
  | 'npmignore'
  | 'yarnignore'
  | 'pnpmignore'
  | 'bazel'
  | 'buck'
  | 'meson'
  | 'ninja'
  | 'gn'
  | 'gnbuild'
  | 'gnargs'
  | 'starlark';

export interface ASTNode {
  type: string;
  text: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  children: ASTNode[];
  metadata?: Record<string, any>;
}

export interface ParseResult {
  ast: ASTNode;
  language: SupportedLanguage;
  filePath: string;
  metadata: {
    packageName?: string;
    functions: FunctionInfo[];
    classes: ClassInfo[];
    imports: ImportInfo[];
    exports: ExportInfo[];
    variables: VariableInfo[];
    complexity: number;
    linesOfCode: number;
    commentLines: number;
    dependencies: string[];
    patterns: CodePattern[];
  };
}

export interface FunctionInfo {
  name: string;
  startLine: number;
  endLine: number;
  parameters: string[];
  returnType?: string;
  modifiers: string[];
  documentation?: string;
  complexity: number;
}

export interface ClassInfo {
  name: string;
  startLine: number;
  endLine: number;
  methods: FunctionInfo[];
  properties: VariableInfo[];
  inheritance?: string[];
  interfaces?: string[];
  documentation?: string;
}

export interface ImportInfo {
  module: string;
  symbols: string[];
  type: 'default' | 'named' | 'namespace';
  line: number;
}

export interface ExportInfo {
  symbols: string[];
  type: 'default' | 'named' | 'namespace';
  line: number;
}

export interface VariableInfo {
  name: string;
  type?: string;
  line: number;
  scope: 'local' | 'global' | 'class' | 'function';
  modifiers: string[];
}

export interface CodePattern {
  type: string;
  name: string;
  line: number;
  description: string;
  severity: 'info' | 'warning' | 'error';
}

// Language grammar mapping
const LANGUAGE_GRAMMARS: Record<SupportedLanguage, string> = {
  javascript: 'tree-sitter-javascript.wasm',
  typescript: 'tree-sitter-typescript.wasm',
  python: 'tree-sitter-python.wasm',
  java: 'tree-sitter-java.wasm',
  c: 'tree-sitter-c.wasm',
  cpp: 'tree-sitter-cpp.wasm',
  go: 'tree-sitter-go.wasm',
  rust: 'tree-sitter-rust.wasm',
  html: 'tree-sitter-html.wasm',
  css: 'tree-sitter-css.wasm',
  json: 'tree-sitter-json.wasm',
  yaml: 'tree-sitter-yaml.wasm',
  markdown: 'tree-sitter-markdown.wasm',
  php: 'tree-sitter-php.wasm',
  ruby: 'tree-sitter-ruby.wasm',
  swift: 'tree-sitter-swift.wasm',
  kotlin: 'tree-sitter-kotlin.wasm',
  dart: 'tree-sitter-dart.wasm',
  lua: 'tree-sitter-lua.wasm',
  shell: 'tree-sitter-bash.wasm',
  sql: 'tree-sitter-sql.wasm',
  xml: 'tree-sitter-xml.wasm',
  dockerfile: 'tree-sitter-dockerfile.wasm',
  makefile: 'tree-sitter-make.wasm',
  cmake: 'tree-sitter-cmake.wasm',
  toml: 'tree-sitter-toml.wasm',
  ini: 'tree-sitter-ini.wasm',
  perl: 'tree-sitter-perl.wasm',
  r: 'tree-sitter-r.wasm',
  julia: 'tree-sitter-julia.wasm',
  elixir: 'tree-sitter-elixir.wasm',
  clojure: 'tree-sitter-clojure.wasm',
  haskell: 'tree-sitter-haskell.wasm',
  scala: 'tree-sitter-scala.wasm',
  erlang: 'tree-sitter-erlang.wasm',
  fsharp: 'tree-sitter-fsharp.wasm',
  ocaml: 'tree-sitter-ocaml.wasm',
  scheme: 'tree-sitter-scheme.wasm',
  lisp: 'tree-sitter-commonlisp.wasm',
  fortran: 'tree-sitter-fortran.wasm',
  matlab: 'tree-sitter-matlab.wasm',
  vba: 'tree-sitter-vba.wasm',
  powershell: 'tree-sitter-powershell.wasm',
  vim: 'tree-sitter-vim.wasm',
  latex: 'tree-sitter-latex.wasm',
  bibtex: 'tree-sitter-bibtex.wasm',
  graphql: 'tree-sitter-graphql.wasm',
  proto: 'tree-sitter-proto.wasm',
  thrift: 'tree-sitter-thrift.wasm',
  capnp: 'tree-sitter-capnp.wasm',
  asn1: 'tree-sitter-asn1.wasm',
  regex: 'tree-sitter-regex.wasm',
  diff: 'tree-sitter-diff.wasm',
  gitcommit: 'tree-sitter-gitcommit.wasm',
  gitrebase: 'tree-sitter-gitrebase.wasm',
  gitattributes: 'tree-sitter-gitattributes.wasm',
  gitignore: 'tree-sitter-gitignore.wasm',
  dockerignore: 'tree-sitter-dockerignore.wasm',
  editorconfig: 'tree-sitter-editorconfig.wasm',
  eslintignore: 'tree-sitter-eslintignore.wasm',
  prettierignore: 'tree-sitter-prettierignore.wasm',
  npmignore: 'tree-sitter-npmignore.wasm',
  yarnignore: 'tree-sitter-yarnignore.wasm',
  pnpmignore: 'tree-sitter-pnpmignore.wasm',
  bazel: 'tree-sitter-bazel.wasm',
  buck: 'tree-sitter-buck.wasm',
  meson: 'tree-sitter-meson.wasm',
  ninja: 'tree-sitter-ninja.wasm',
  gn: 'tree-sitter-gn.wasm',
  gnbuild: 'tree-sitter-gnbuild.wasm',
  gnargs: 'tree-sitter-gnargs.wasm',
  starlark: 'tree-sitter-starlark.wasm',
};

// Singleton Tree-sitter parser implementation
export class TreeSitterParser {
  private static _instance: TreeSitterParser;
  private _initialized = false;
  private _functionCounter = 0;
  private _classCounter = 0;

  private constructor() {}

  static getInstance(): TreeSitterParser {
    if (!TreeSitterParser._instance) {
      TreeSitterParser._instance = new TreeSitterParser();
    }

    return TreeSitterParser._instance;
  }

  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    try {
      console.log('Tree-sitter parser initialized (mock mode)');
      this._initialized = true;
    } catch (error) {
      console.error('Failed to initialize Tree-sitter:', error);
      throw error;
    }
  }

  async parse(code: string, language: SupportedLanguage, filePath: string): Promise<ParseResult> {
    await this.initialize();

    const ast = this._createMockAST(code, language);
    const metadata = this._extractMetadata(ast, code, language, filePath);

    return {
      ast,
      language,
      filePath,
      metadata,
    };
  }

  private _createMockAST(code: string, language: SupportedLanguage): ASTNode {
    const lines = code.split('\n');

    const rootNode: ASTNode = {
      type: 'program',
      text: code,
      startLine: 0,
      startCol: 0,
      endLine: lines.length - 1,
      endCol: lines[lines.length - 1]?.length || 0,
      children: [],
    };

    this._addMockNodes(rootNode, code, language);

    return rootNode;
  }

  private _addMockNodes(parentNode: ASTNode, code: string, language: SupportedLanguage): void {
    const lines = code.split('\n');

    lines.forEach((line, lineIndex) => {
      const trimmedLine = line.trim();

      if (this._isFunctionLine(trimmedLine, language)) {
        const funcName = this._extractFunctionNameFromLine(trimmedLine, language);

        if (funcName) {
          const funcNode: ASTNode = {
            type: this._getFunctionNodeType(language),
            text: trimmedLine,
            startLine: lineIndex,
            startCol: line.indexOf(trimmedLine),
            endLine: lineIndex,
            endCol: line.indexOf(trimmedLine) + trimmedLine.length,
            children: [],
            metadata: { name: funcName },
          };
          parentNode.children.push(funcNode);
        }
      }

      if (this._isClassLine(trimmedLine, language)) {
        const className = this._extractClassNameFromLine(trimmedLine, language);

        if (className) {
          const classNode: ASTNode = {
            type: this._getClassNodeType(language),
            text: trimmedLine,
            startLine: lineIndex,
            startCol: line.indexOf(trimmedLine),
            endLine: lineIndex,
            endCol: line.indexOf(trimmedLine) + trimmedLine.length,
            children: [],
            metadata: { name: className },
          };
          parentNode.children.push(classNode);
        }
      }

      if (this._isImportLine(trimmedLine, language)) {
        const importNode: ASTNode = {
          type: this._getImportNodeType(language),
          text: trimmedLine,
          startLine: lineIndex,
          startCol: line.indexOf(trimmedLine),
          endLine: lineIndex,
          endCol: line.indexOf(trimmedLine) + trimmedLine.length,
          children: [],
        };
        parentNode.children.push(importNode);
      }
    });
  }

  private _isFunctionLine(line: string, language: SupportedLanguage): boolean {
    if (language === 'java') {
      return (
        (line.includes('public') || line.includes('private') || line.includes('protected')) &&
        line.includes('(') &&
        line.includes(')') &&
        !line.includes('class') &&
        !line.includes('interface')
      );
    }

    const patterns: Partial<Record<SupportedLanguage, RegExp>> = {
      javascript:
        /^(async\s+)?function\s+\w+|const\s+\w+\s*=\s*(async\s+)?\(.*\)\s*=>|\w+\s*:\s*(async\s+)?\(.*\)\s*=>/,
      typescript:
        /^(async\s+)?function\s+\w+|const\s+\w+\s*=\s*(async\s+)?\(.*\)\s*=>|\w+\s*:\s*(async\s+)?\(.*\)\s*=>/,
      python: /^def\s+\w+/,
      java: /^(public|private|protected|static|\s)*\s*\w+\s+\w+\s*\(/,
      go: /^func\s+\w+/,
      rust: /^fn\s+\w+/,
      c: /^\w+\s+\w+\s*\(/,
      cpp: /^\w+\s+\w+\s*\(/,
      php: /^function\s+\w+/,
      ruby: /^def\s+\w+/,
      swift: /^func\s+\w+/,
      kotlin: /^fun\s+\w+/,
      dart: /^\w+\s+\w+\s*\(/,
      lua: /^function\s+\w+/,
      shell: /^\w+\s*\(\)/,
      perl: /^sub\s+\w+/,
      julia: /^function\s+\w+/,
      elixir: /^def\s+\w+/,
      clojure: /\(defn\s+\w+/,
      haskell: /^\w+\s*::/,
      scala: /^def\s+\w+/,
      fsharp: /^let\s+\w+/,
      ocaml: /^let\s+\w+/,
      scheme: /\(define\s+\(/,
      lisp: /\(defun\s+\w+/,
      fortran: /^\w+\s+function\s+\w+/,
      matlab: /^function\s+\w+/,
      vba: /^Function\s+\w+/,
      powershell: /^function\s+\w+/,
      r: /^\w+\s*<-\s*function/,
    };

    return patterns[language]?.test(line) || false;
  }

  private _isClassLine(line: string, language: SupportedLanguage): boolean {
    if (language === 'java') {
      return line.includes('class') || line.includes('interface') || line.includes('enum');
    }

    const patterns: Partial<Record<SupportedLanguage, RegExp>> = {
      javascript: /class\s+\w+/,
      typescript: /class\s+\w+|interface\s+\w+/,
      python: /class\s+\w+/,
      java: /class\s+\w+|interface\s+\w+/,
      go: /type\s+\w+\s+struct/,
      rust: /struct\s+\w+|enum\s+\w+/,
      cpp: /class\s+\w+|struct\s+\w+/,
      php: /class\s+\w+/,
      ruby: /class\s+\w+/,
      swift: /class\s+\w+|struct\s+\w+/,
      kotlin: /class\s+\w+|interface\s+\w+/,
      dart: /class\s+\w+/,
      scala: /class\s+\w+|trait\s+\w+/,
      fsharp: /type\s+\w+/,
      ocaml: /type\s+\w+/,
      haskell: /data\s+\w+/,
    };

    return patterns[language]?.test(line) || false;
  }

  private _isImportLine(line: string, language: SupportedLanguage): boolean {
    const patterns: Partial<Record<SupportedLanguage, RegExp>> = {
      javascript: /^(import|require)\s+/,
      typescript: /^(import|require)\s+/,
      python: /^(import|from)\s+/,
      java: /^import\s+/,
      go: /^import\s+/,
      rust: /^use\s+/,
      cpp: /^#include\s+/,
      c: /^#include\s+/,
      php: /^(use|require_once|include_once)\s+/,
      ruby: /^require\s+/,
      swift: /^import\s+/,
      kotlin: /^import\s+/,
      dart: /^import\s+/,
      scala: /^import\s+/,
      fsharp: /^open\s+/,
      ocaml: /^open\s+/,
      haskell: /^import\s+/,
      elixir: /^(import|require)\s+/,
      clojure: /\(:require\s+/,
      erlang: /^-import\(/,
      lisp: /\(require\s+/,
      scheme: /\(import\s+/,
      r: /^(library|require)\s*\(/,
      julia: /^(using|import)\s+/,
      perl: /^(use|require)\s+/,
      lua: /^(require)\s+/,
    };

    return patterns[language]?.test(line) || false;
  }

  private _extractFunctionNameFromLine(line: string, language: SupportedLanguage): string | null {
    const patterns: Partial<Record<SupportedLanguage, RegExp>> = {
      javascript: /(?:function|const|let|var)\s+(\w+)/,
      typescript: /(?:function|const|let|var)\s+(\w+)/,
      python: /def\s+(\w+)/,
      java: /(?:public|private|protected|static|\s)*\s*(\w+)\s+(\w+)\s*\(/,
      go: /func\s+(\w+)/,
      rust: /fn\s+(\w+)/,
      c: /(\w+)\s+(\w+)\s*\(/,
      cpp: /(\w+)\s+(\w+)\s*\(/,
      php: /function\s+(\w+)/,
      ruby: /def\s+(\w+)/,
      swift: /func\s+(\w+)/,
      kotlin: /fun\s+(\w+)/,
      dart: /(\w+)\s+(\w+)\s*\(/,
      lua: /function\s+(\w+)/,
      shell: /(\w+)\s*\(\)/,
      perl: /sub\s+(\w+)/,
      julia: /function\s+(\w+)/,
      elixir: /def\s+(\w+)/,
      clojure: /\(defn\s+(\w+)/,
      haskell: /(\w+)\s*::/,
      scala: /def\s+(\w+)/,
      fsharp: /let\s+(\w+)/,
      ocaml: /let\s+(\w+)/,
      scheme: /\(define\s+\((\w+)/,
      lisp: /\(defun\s+(\w+)/,
      fortran: /\w+\s+function\s+(\w+)/,
      matlab: /function\s+(\w+)/,
      vba: /Function\s+(\w+)/,
      powershell: /function\s+(\w+)/,
      r: /(\w+)\s*<-\s*function/,
    };

    const match = line.match(patterns[language] || /(\w+)/);

    return match ? match[1] || match[2] : null;
  }

  private _extractClassNameFromLine(line: string, language: SupportedLanguage): string | null {
    const patterns: Partial<Record<SupportedLanguage, RegExp>> = {
      javascript: /class\s+(\w+)/,
      typescript: /(?:class|interface)\s+(\w+)/,
      python: /class\s+(\w+)/,
      java: /(?:class|interface)\s+(\w+)/,
      go: /type\s+(\w+)\s+struct/,
      rust: /(?:struct|enum)\s+(\w+)/,
      cpp: /(?:class|struct)\s+(\w+)/,
      php: /class\s+(\w+)/,
      ruby: /class\s+(\w+)/,
      swift: /(?:class|struct)\s+(\w+)/,
      kotlin: /(?:class|interface)\s+(\w+)/,
      dart: /class\s+(\w+)/,
      scala: /(?:class|trait)\s+(\w+)/,
      fsharp: /type\s+(\w+)/,
      ocaml: /type\s+(\w+)/,
      haskell: /data\s+(\w+)/,
    };

    const match = line.match(patterns[language] || /(\w+)/);

    return match ? match[1] : null;
  }

  private _getFunctionNodeType(language: SupportedLanguage): string {
    const types: Partial<Record<SupportedLanguage, string>> = {
      javascript: 'function_declaration',
      typescript: 'function_declaration',
      python: 'function_definition',
      java: 'method_declaration',
      go: 'function_declaration',
      rust: 'function_item',
      c: 'function_definition',
      cpp: 'function_definition',
      php: 'function_declaration',
      ruby: 'method_declaration',
      swift: 'function_declaration',
      kotlin: 'function_declaration',
      dart: 'function_declaration',
      lua: 'function_declaration',
      shell: 'function_definition',
      perl: 'subroutine_declaration',
      julia: 'function_definition',
      elixir: 'function_declaration',
      clojure: 'function_declaration',
      haskell: 'function_declaration',
      scala: 'function_declaration',
      fsharp: 'function_declaration',
      ocaml: 'function_declaration',
      scheme: 'function_declaration',
      lisp: 'function_declaration',
      fortran: 'function_definition',
      matlab: 'function_declaration',
      vba: 'function_declaration',
      powershell: 'function_declaration',
      r: 'function_declaration',
    };

    return types[language] || 'function_declaration';
  }

  private _getClassNodeType(language: SupportedLanguage): string {
    const types: Partial<Record<SupportedLanguage, string>> = {
      javascript: 'class_declaration',
      typescript: 'class_declaration',
      python: 'class_definition',
      java: 'class_declaration',
      go: 'type_declaration',
      rust: 'struct_item',
      cpp: 'class_specifier',
      php: 'class_declaration',
      ruby: 'class_declaration',
      swift: 'class_declaration',
      kotlin: 'class_declaration',
      dart: 'class_declaration',
      scala: 'class_declaration',
      fsharp: 'type_declaration',
      ocaml: 'type_declaration',
      haskell: 'data_declaration',
    };

    return types[language] || 'class_declaration';
  }

  private _getImportNodeType(language: SupportedLanguage): string {
    const types: Partial<Record<SupportedLanguage, string>> = {
      javascript: 'import_statement',
      typescript: 'import_statement',
      python: 'import_statement',
      java: 'import_declaration',
      go: 'import_declaration',
      rust: 'use_declaration',
      cpp: 'preproc_include',
      c: 'preproc_include',
      php: 'use_declaration',
      ruby: 'require_statement',
      swift: 'import_declaration',
      kotlin: 'import_declaration',
      dart: 'import_statement',
      scala: 'import_declaration',
      fsharp: 'open_declaration',
      ocaml: 'open_declaration',
      haskell: 'import_declaration',
      elixir: 'import_statement',
      clojure: 'require_statement',
      erlang: 'import_declaration',
      lisp: 'require_statement',
      scheme: 'import_statement',
      r: 'library_statement',
      julia: 'using_statement',
      perl: 'use_statement',
      lua: 'require_statement',
    };

    return types[language] || 'import_statement';
  }

  private _extractMetadata(
    ast: ASTNode,
    code: string,
    language: SupportedLanguage,
    _filePath: string,
  ): ParseResult['metadata'] {
    const metadata: ParseResult['metadata'] = {
      functions: [],
      classes: [],
      imports: [],
      exports: [],
      variables: [],
      complexity: 0,
      linesOfCode: 0,
      commentLines: 0,
      dependencies: [],
      patterns: [],
    };

    // Extract package name for Java, Go, Kotlin
    if (language === 'java' || language === 'kotlin') {
      const packageMatch = code.match(/^package\s+([\w.]+);/m);

      if (packageMatch) {
        metadata.packageName = packageMatch[1];
      }
    } else if (language === 'go') {
      const packageMatch = code.match(/^package\s+(\w+)/m);

      if (packageMatch) {
        metadata.packageName = packageMatch[1];
      }
    } else if (language === 'php') {
      const packageMatch = code.match(/^namespace\s+([\w\\]+);/m);

      if (packageMatch) {
        metadata.packageName = packageMatch[1];
      }
    } else if (language === 'c' || language === 'cpp') {
      // C/C++ namespace heuristic
      const namespaceMatch = code.match(/^namespace\s+(\w+)/m);

      if (namespaceMatch) {
        metadata.packageName = namespaceMatch[1];
      }
    }

    this._traverseAST(ast, metadata, code, language);

    // Calculate basic metrics
    const lines = code.split('\n');
    metadata.linesOfCode = lines.length;
    metadata.commentLines = lines.filter((line) => {
      const trimmed = line.trim();
      return trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('/*') || trimmed.startsWith('*');
    }).length;

    return metadata;
  }

  private _traverseAST(
    node: ASTNode,
    metadata: ParseResult['metadata'],
    code: string,
    language: SupportedLanguage,
  ): void {
    // Extract functions
    if (node.type.includes('function') || node.type.includes('method')) {
      const funcInfo = this._extractFunctionInfo(node, code, language, metadata);

      if (funcInfo) {
        metadata.functions.push(funcInfo);
      }
    }

    // Extract classes
    if (node.type.includes('class') || node.type.includes('struct') || node.type.includes('interface')) {
      const classInfo = this._extractClassInfo(node, code, language, metadata);

      if (classInfo) {
        metadata.classes.push(classInfo);
      }
    }

    // Extract imports
    if (node.type.includes('import') || node.type.includes('use') || node.type.includes('require')) {
      const importInfo = this._extractImportInfo(node, code, language);

      if (importInfo) {
        metadata.imports.push(importInfo);
      }
    }

    // Traverse children
    for (const child of node.children) {
      this._traverseAST(child, metadata, code, language);
    }
  }

  private _extractFunctionInfo(
    node: ASTNode,
    _code: string,
    _language: SupportedLanguage,
    _metadata: ParseResult['metadata'],
  ): FunctionInfo | null {
    try {
      const name = node.metadata?.name || `function_${++this._functionCounter}`;

      return {
        name,
        startLine: node.startLine,
        endLine: node.endLine,
        parameters: [], // Would extract from actual AST
        returnType: undefined,
        modifiers: [],
        documentation: undefined,
        complexity: 1,
      };
    } catch (error) {
      console.error('Failed to extract function info:', error);
      return null;
    }
  }

  private _extractClassInfo(
    node: ASTNode,
    _code: string,
    _language: SupportedLanguage,
    _metadata: ParseResult['metadata'],
  ): ClassInfo | null {
    try {
      const name = node.metadata?.name || `class_${++this._classCounter}`;

      return {
        name,
        startLine: node.startLine,
        endLine: node.endLine,
        methods: [],
        properties: [],
        inheritance: [],
        interfaces: [],
        documentation: undefined,
      };
    } catch (error) {
      console.error('Failed to extract class info:', error);
      return null;
    }
  }

  private _extractImportInfo(node: ASTNode, code: string, language: SupportedLanguage): ImportInfo | null {
    try {
      const line = node.text.trim();
      let module = 'unknown_module';
      let symbols: string[] = [];

      if (language === 'java') {
        const match = line.match(/^import\s+(?:static\s+)?([\w.]+);?/);

        if (match) {
          module = match[1];

          // For Java, the last part is usually the class/symbol
          const parts = module.split('.');
          symbols = [parts[parts.length - 1]];
        }
      } else if (language === 'javascript' || language === 'typescript') {
        const fromMatch = line.match(/from\s+['"](.+)['"]/);

        if (fromMatch) {
          module = fromMatch[1];
        }
      } else if (language === 'python') {
        const fromMatch = line.match(/from\s+([\w.]+)\s+import/);
        const importMatch = line.match(/^import\s+([\w.]+)/);

        if (fromMatch) {
          module = fromMatch[1];
        } else if (importMatch) {
          module = importMatch[1];
        }
      }

      return {
        module,
        symbols,
        type: 'named',
        line: node.startLine,
      };
    } catch (error) {
      console.error('Failed to extract import info:', error);
      return null;
    }
  }

  getSupportedLanguages(): SupportedLanguage[] {
    return Object.keys(LANGUAGE_GRAMMARS) as SupportedLanguage[];
  }

  isLanguageSupported(language: string): language is SupportedLanguage {
    return language in LANGUAGE_GRAMMARS;
  }

  getLanguageFromExtension(filePath: string): SupportedLanguage | null {
    const ext = filePath.split('.').pop()?.toLowerCase();

    if (!ext) {
      return null;
    }

    const extensionMap: Record<string, SupportedLanguage> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      c: 'c',
      h: 'c',
      cpp: 'cpp',
      cxx: 'cpp',
      hpp: 'cpp',
      cc: 'cpp',
      html: 'html',
      htm: 'html',
      css: 'css',
      scss: 'css',
      sass: 'css',
      less: 'css',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      md: 'markdown',
      markdown: 'markdown',
      php: 'php',
      php3: 'php',
      php4: 'php',
      php5: 'php',
      phtml: 'php',
      rb: 'ruby',
      ruby: 'ruby',
      swift: 'swift',
      kt: 'kotlin',
      kts: 'kotlin',
      dart: 'dart',
      lua: 'lua',
      sh: 'shell',
      bash: 'shell',
      zsh: 'shell',
      fish: 'shell',
      sql: 'sql',
      xml: 'xml',
      xhtml: 'xml',
      xsd: 'xml',
      xsl: 'xml',
      xslt: 'xml',
      dockerfile: 'dockerfile',
      docker: 'dockerfile',
      makefile: 'makefile',
      mk: 'makefile',
      cmake: 'cmake',
      toml: 'toml',
      ini: 'ini',
      cfg: 'ini',
      conf: 'ini',
      pl: 'perl',
      pm: 'perl',
      r: 'r',
      R: 'r',
      jl: 'julia',
      ex: 'elixir',
      exs: 'elixir',
      clj: 'clojure',
      cljs: 'clojure',
      cljc: 'clojure',
      hs: 'haskell',
      lhs: 'haskell',
      scala: 'scala',
      sc: 'scala',
      erl: 'erlang',
      hrl: 'erlang',
      fs: 'fsharp',
      fsx: 'fsharp',
      fsi: 'fsharp',
      ml: 'ocaml',
      mli: 'ocaml',
      scm: 'scheme',
      ss: 'scheme',
      lisp: 'lisp',
      lsp: 'lisp',
      f: 'fortran',
      for: 'fortran',
      f90: 'fortran',
      f95: 'fortran',
      f03: 'fortran',
      f08: 'fortran',
      f15: 'fortran',
      m: 'matlab',
      vba: 'vba',
      bas: 'vba',
      ps1: 'powershell',
      psm1: 'powershell',
      psd1: 'powershell',
      vim: 'vim',
      tex: 'latex',
      latex: 'latex',
      ltx: 'latex',
      sty: 'latex',
      cls: 'latex',
      bib: 'bibtex',
      graphql: 'graphql',
      gql: 'graphql',
      proto: 'proto',
      thrift: 'thrift',
      capnp: 'capnp',
      asn1: 'asn1',
      asn: 'asn1',
      regex: 'regex',
      regexp: 'regex',
      re: 'regex',
      diff: 'diff',
      patch: 'diff',
      commit: 'gitcommit',
      rebase: 'gitrebase',
      gitattributes: 'gitattributes',
      gitignore: 'gitignore',
      dockerignore: 'dockerignore',
      editorconfig: 'editorconfig',
      eslintignore: 'eslintignore',
      prettierignore: 'prettierignore',
      npmignore: 'npmignore',
      yarnignore: 'yarnignore',
      pnpmignore: 'pnpmignore',
      bazel: 'bazel',
      BUILD: 'bazel',
      WORKSPACE: 'bazel',
      buck: 'buck',
      BUCK: 'buck',
      meson: 'meson',
      ninja: 'ninja',
      gn: 'gn',
      gnbuild: 'gnbuild',
      gnargs: 'gnargs',
      starlark: 'starlark',
    };

    return extensionMap[ext] || null;
  }

  async parseProject(files: Array<{ path: string; content: string }>): Promise<ParseResult[]> {
    const results: ParseResult[] = [];

    for (const file of files) {
      const language = this.getLanguageFromExtension(file.path);

      if (language && this.isLanguageSupported(language)) {
        try {
          const result = await this.parse(file.content, language, file.path);
          results.push(result);
        } catch (error) {
          console.error(`Failed to parse ${file.path}:`, error);

          // Continue with other files
        }
      }
    }

    return results;
  }

  dispose(): void {
    // Clean up resources if needed
    console.log('Tree-sitter parser disposed');
  }
}

// Singleton instance
let parserInstance: TreeSitterParser | null = null;

export async function getTreeSitterParser(): Promise<TreeSitterParser> {
  if (!parserInstance) {
    parserInstance = TreeSitterParser.getInstance();
    await parserInstance.initialize();
  }

  return parserInstance;
}
