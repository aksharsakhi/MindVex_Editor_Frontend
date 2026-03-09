/**
 * treeSitterParser.ts
 *
 * Singleton module that initialises web-tree-sitter once and exposes
 * a synchronous-feeling parse() API for use on the main thread.
 *
 * Supported languages: 50+ languages including Java, Python, TS, JS, C/C++, Go, Rust, etc.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const parserModule: any = require('web-tree-sitter');

// ─── Types ────────────────────────────────────────────────────────────────────

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

// Grammar WASM paths — served from /public/ at runtime
const GRAMMAR_URLS: Record<SupportedLanguage, string> = {
  java: '/tree-sitter-java.wasm',
  python: '/tree-sitter-python.wasm',
  typescript: '/tree-sitter-typescript.wasm',
  javascript: '/tree-sitter-javascript.wasm',
  c: '/tree-sitter-c.wasm',
  cpp: '/tree-sitter-cpp.wasm',
  go: '/tree-sitter-go.wasm',
  rust: '/tree-sitter-rust.wasm',
  html: '/tree-sitter-html.wasm',
  css: '/tree-sitter-css.wasm',
  json: '/tree-sitter-json.wasm',
  yaml: '/tree-sitter-yaml.wasm',
  markdown: '/tree-sitter-markdown.wasm',
  php: '/tree-sitter-php.wasm',
  ruby: '/tree-sitter-ruby.wasm',
  swift: '/tree-sitter-swift.wasm',
  kotlin: '/tree-sitter-kotlin.wasm',
  dart: '/tree-sitter-dart.wasm',
  lua: '/tree-sitter-lua.wasm',
  shell: '/tree-sitter-bash.wasm',
  sql: '/tree-sitter-sql.wasm',
  xml: '/tree-sitter-xml.wasm',
  dockerfile: '/tree-sitter-dockerfile.wasm',
  makefile: '/tree-sitter-make.wasm',
  cmake: '/tree-sitter-cmake.wasm',
  toml: '/tree-sitter-toml.wasm',
  ini: '/tree-sitter-ini.wasm',
  perl: '/tree-sitter-perl.wasm',
  r: '/tree-sitter-r.wasm',
  julia: '/tree-sitter-julia.wasm',
  elixir: '/tree-sitter-elixir.wasm',
  clojure: '/tree-sitter-clojure.wasm',
  haskell: '/tree-sitter-haskell.wasm',
  scala: '/tree-sitter-scala.wasm',
  erlang: '/tree-sitter-erlang.wasm',
  fsharp: '/tree-sitter-fsharp.wasm',
  ocaml: '/tree-sitter-ocaml.wasm',
  scheme: '/tree-sitter-scheme.wasm',
  lisp: '/tree-sitter-commonlisp.wasm',
  fortran: '/tree-sitter-fortran.wasm',
  matlab: '/tree-sitter-matlab.wasm',
  vba: '/tree-sitter-vba.wasm',
  powershell: '/tree-sitter-powershell.wasm',
  vim: '/tree-sitter-vim.wasm',
  latex: '/tree-sitter-latex.wasm',
  bibtex: '/tree-sitter-bibtex.wasm',
  graphql: '/tree-sitter-graphql.wasm',
  proto: '/tree-sitter-proto.wasm',
  thrift: '/tree-sitter-thrift.wasm',
  capnp: '/tree-sitter-capnp.wasm',
  asn1: '/tree-sitter-asn1.wasm',
  regex: '/tree-sitter-regex.wasm',
  diff: '/tree-sitter-diff.wasm',
  gitcommit: '/tree-sitter-gitcommit.wasm',
  gitrebase: '/tree-sitter-gitrebase.wasm',
  gitattributes: '/tree-sitter-gitattributes.wasm',
  gitignore: '/tree-sitter-gitignore.wasm',
  dockerignore: '/tree-sitter-dockerignore.wasm',
  editorconfig: '/tree-sitter-editorconfig.wasm',
  eslintignore: '/tree-sitter-eslintignore.wasm',
  prettierignore: '/tree-sitter-prettierignore.wasm',
  npmignore: '/tree-sitter-npmignore.wasm',
  yarnignore: '/tree-sitter-yarnignore.wasm',
  pnpmignore: '/tree-sitter-pnpmignore.wasm',
  bazel: '/tree-sitter-bazel.wasm',
  buck: '/tree-sitter-buck.wasm',
  meson: '/tree-sitter-meson.wasm',
  ninja: '/tree-sitter-ninja.wasm',
  gn: '/tree-sitter-gn.wasm',
  gnbuild: '/tree-sitter-gnbuild.wasm',
  gnargs: '/tree-sitter-gnargs.wasm',
  starlark: '/tree-sitter-starlark.wasm',
};

// ─── Singleton State ──────────────────────────────────────────────────────────

let parserReady = false;
let initPromise: Promise<void> | null = null;

const languageCache = new Map<SupportedLanguage, any>();

const parserInstances = new Map<SupportedLanguage, any>();

// ─── Init ─────────────────────────────────────────────────────────────────────

/**
 * Initialise the tree-sitter WASM runtime.
 * Safe to call multiple times — subsequent calls return the cached promise.
 */
export async function initParser(): Promise<void> {
  if (parserReady) {
    return Promise.resolve();
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    await parserModule.init({
      locateFile(scriptName: string) {
        if (scriptName === 'tree-sitter.wasm') {
          return '/tree-sitter.wasm';
        }

        return scriptName;
      },
    });
    parserReady = true;
  })();

  return initPromise;
}

// ─── Language Loading ─────────────────────────────────────────────────────────

async function loadLanguage(lang: SupportedLanguage): Promise<any> {
  if (languageCache.has(lang)) {
    return languageCache.get(lang);
  }

  const url = GRAMMAR_URLS[lang];

  try {
    const langObj = await parserModule.Language.load(url);
    languageCache.set(lang, langObj);

    return langObj;
  } catch (e) {
    console.error(`Failed to load grammar for ${lang} from ${url}:`, e);
    throw e;
  }
}

// ─── Main API ─────────────────────────────────────────────────────────────────

/**
 * Parse a string of code into a Tree-sitter tree.
 * Automatically initialises the runtime and loads the requested grammar.
 */
export async function parse(code: string, lang: SupportedLanguage): Promise<any> {
  await initParser();

  let parser = parserInstances.get(lang);

  if (!parser) {
    parser = new parserModule();

    const langObj = await loadLanguage(lang);
    parser.setLanguage(langObj);
    parserInstances.set(lang, parser);
  }

  return parser.parse(code);
}

/**
 * Helper to determine language from file extension.
 */
export function getLanguageFromExtension(filePath: string): SupportedLanguage | null {
  const ext = filePath.split('.').pop()?.toLowerCase();

  switch (ext) {
    case 'java':
      return 'java';
    case 'py':
      return 'python';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'c':
    case 'h':
      return 'c';
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'hpp':
      return 'cpp';
    case 'go':
      return 'go';
    case 'rs':
      return 'rust';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'php':
      return 'php';
    case 'rb':
      return 'ruby';
    case 'swift':
      return 'swift';
    case 'kt':
      return 'kotlin';
    case 'dart':
      return 'dart';
    case 'lua':
      return 'lua';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'sql':
      return 'sql';
    case 'xml':
      return 'xml';
    case 'toml':
      return 'toml';
    case 'ini':
      return 'ini';
    case 'pl':
      return 'perl';
    case 'r':
      return 'r';
    case 'jl':
      return 'julia';
    case 'ex':
    case 'exs':
      return 'elixir';
    case 'clj':
      return 'clojure';
    case 'hs':
      return 'haskell';
    case 'scala':
      return 'scala';
    case 'erl':
      return 'erlang';
    case 'fs':
      return 'fsharp';
    case 'ml':
      return 'ocaml';
    case 'scm':
      return 'scheme';
    case 'lisp':
      return 'lisp';
    case 'f':
    case 'f90':
      return 'fortran';
    case 'm':
      return 'matlab';
    case 'ps1':
      return 'powershell';
    case 'vim':
      return 'vim';
    case 'tex':
      return 'latex';
    case 'graphql':
      return 'graphql';
    case 'proto':
      return 'proto';
    default:
      return null;
  }
}
