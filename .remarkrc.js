const fs = require("fs");
const unified = require("unified");

const dictionary = fs.readFileSync("./dictionary.txt");

module.exports = {
  plugins: [
    ["remark-frontmatter", "yaml"],
    [
      "remark-retext",
      unified()
        .use(require("retext-english"))
        .use(require("retext-syntax-urls"))
        .use(require("retext-syntax-mentions"))
        .use(require("retext-emoji"))
        .use(require("retext-spell"), {
          dictionary: require("dictionary-en"),
          personal: dictionary,
        })
        .use(require("retext-diacritics"))
        .use(require("retext-indefinite-article"))
        .use(require("retext-redundant-acronyms"))
        .use(require("retext-sentence-spacing")),
    ],
    "remark-preset-lint-recommended",
    "remark-preset-lint-markdown-style-guide",
    ["remark-lint-maximum-line-length", false],
  ],
};