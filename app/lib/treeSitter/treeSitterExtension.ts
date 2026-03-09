/**
 * treeSitterExtension.ts
 *
 * A CodeMirror 6 ViewPlugin that integrates tree-sitter syntax highlighting.
 */

import { Decoration, type DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { initParser } from './treeSitterParser';
import type { SupportedLanguage } from './treeSitterParser';
import { getHighlightRanges } from './treeSitterHighlighter';

// ─── Highlight CSS classes ────────────────────────────────────────────────────

const decorationCache = new Map<string, Decoration>();

function getDecoration(className: string): Decoration {
  if (!decorationCache.has(className)) {
    decorationCache.set(className, Decoration.mark({ class: className }));
  }

  return decorationCache.get(className)!;
}

// ─── Plugin factory ───────────────────────────────────────────────────────────

/**
 * Create a CodeMirror 6 extension that applies tree-sitter syntax highlighting.
 *
 * @param lang - The language to highlight.
 */
export function treeSitterHighlight(lang: SupportedLanguage) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none;
      private _parser: any = null;
      private _tsLanguage: any = null;
      private _tree: any = null;

      constructor(view: EditorView) {
        this._init(view, lang);
      }

      private async _init(view: EditorView, language: SupportedLanguage) {
        await initParser();

        const tsLang = await loadTsLanguage(language);

        if (!tsLang) {
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const parserCtor = require('web-tree-sitter') as any;
        const parser = new parserCtor();
        parser.setLanguage(tsLang);

        this._parser = parser;
        this._tsLanguage = tsLang;

        const source = view.state.doc.toString();
        this._tree = parser.parse(source);
        this.decorations = buildDecorations(this._tree, language, tsLang);
        view.update([]);
      }

      update(update: ViewUpdate) {
        if (!update.docChanged || !this._parser || !this._tsLanguage) {
          return;
        }

        const source = update.state.doc.toString();
        this._tree = this._parser.parse(source, this._tree);
        this.decorations = buildDecorations(this._tree, lang, this._tsLanguage);
      }
    },
    { decorations: (v) => v.decorations },
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDecorations(tree: any, language: SupportedLanguage, tsLanguage: any): DecorationSet {
  const ranges = getHighlightRanges(tree, language, tsLanguage);
  const builder = new RangeSetBuilder<Decoration>();

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);

  for (const r of ranges) {
    builder.add(r.from, r.to, getDecoration(r.className));
  }

  return builder.finish();
}

async function loadTsLanguage(lang: SupportedLanguage): Promise<any | null> {
  const grammarUrls: Record<SupportedLanguage, string> = {
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

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Parser = require('web-tree-sitter') as any;
    return await Parser.Language.load(grammarUrls[lang]);
  } catch {
    console.warn(`[tree-sitter] Failed to load grammar for ${lang}`);
    return null;
  }
}
