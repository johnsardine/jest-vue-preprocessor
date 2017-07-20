/* eslint-env node */
const path = require('path');
const vueCompiler = require('vue-template-compiler');
const vueNextCompiler = require('vue-template-es2015-compiler');
const babelCore = require('babel-core');
const findBabelConfig = require('find-babel-config');
const tsc = require('typescript');

const transformBabel = src => {
  console.log('transformBabel', src);
  const {config} = findBabelConfig.sync(process.cwd());
  const transformOptions = {
    presets: ['es2015'],
    plugins: ['transform-runtime']
  };
  const combinedTransformOptions = config || transformOptions;
  combinedTransformOptions.sourceMaps = 'both';
  //combinedTransformOptions.filename =

  let result;
  try {
    result = babelCore.transform(src, combinedTransformOptions);
  } catch (error) {
    // eslint-disable-next-line
    console.error('Failed to compile scr with `babel` at `vue-preprocessor`');
  }
  return result;
};

const getTsConfig = () => {
  try {
    return require(path.resolve(process.cwd(), 'tsconfig.json'));
  } catch (error) {
    return {};
  }
};

const transformTs = (src, path) => {
  const  {compilerOptions} = getTsConfig();
  let result;
  try {
    result = tsc.transpile(src, compilerOptions, path, []);
  } catch (error) {
    // eslint-disable-next-line
    console.error('Failed to compile src with `tsc` at `vue-preprocessor`');
  }
  return result;
};

const transforms = {
  ts: transformTs,
  typescript: transformTs,
  babel: transformBabel
};

const extractHTML = (template, templatePath) => {
  let resultHTML = '';

  if (!template.lang || template.lang === 'resultHTML') {
    resultHTML = template.content;
  } else if (template.lang === 'pug') {
    resultHTML = require('pug').compile(template.content)();
  } else {
    throw templatePath + ': unknown <template lang="' + template.lang + '">';
  }

  return resultHTML;
};

const generateOutput = (script, renderFn, staticRenderFns, map) => {
  let output = '';
  output +=
    '/* istanbul ignore next */;(function(){\n' + script + '\n})()\n' +
    '/* istanbul ignore next */if (module.exports.__esModule) module.exports = module.exports.default\n';
  output += '/* istanbul ignore next */var __vue__options__ = (typeof module.exports === "function"' +
    '? module.exports.options: module.exports)\n';
  if (renderFn && staticRenderFns) {
    output +=
      '/* istanbul ignore next */__vue__options__.render = ' + renderFn + '\n' +
      '/* istanbul ignore next */__vue__options__.staticRenderFns = ' + staticRenderFns + '\n';
  }
  return { code: output, map: map };
};

const stringifyRender = render => vueNextCompiler('function render () {' + render + '}');

const stringifyStaticRender = staticRenderFns => `[${staticRenderFns.map(stringifyRender).join(',')}]`;

module.exports = {
  process(src, filePath) {
    // code copied from https://github.com/locoslab/vue-typescript-jest/blob/master/preprocessor.js
    // LICENSE MIT
    // @author https://github.com/locobert
    // heavily based on vueify (Copyright (c) 2014-2016 Evan You)
    const { script, template } = vueCompiler.parseComponent(src, { pad: true});
    //console.log('parseComponent', 'script.lang', script.lang, 'script.content', script.content, 'template', template);
    const transform = script.lang || 'babel';
    let transformedScript = script ? transforms[transform](script.content) : '';

    if (transform === 'babel') {
      console.log('src, filePath', src, filePath);
      transformedMap = transformedScript.map;
      transformedScript = transformedScript.code;
    }

    let render;
    let staticRenderFns;
    if (template) {
      const HTML = extractHTML(template, filePath);
      const res = HTML && vueCompiler.compile(HTML);
      render = stringifyRender(res.render);
      staticRenderFns = stringifyStaticRender(res.staticRenderFns);
    }

    return generateOutput(transformedScript, render, staticRenderFns, transformedMap);
  }
};
