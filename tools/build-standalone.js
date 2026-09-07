/* Assemble une version autonome de TravIA : un seul fichier HTML, feuille de
   style et scripts inclus, utilisable hors ligne ou publiable tel quel.
   Usage : node tools/build-standalone.js */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

const html = read('index.html');
const css = read('assets/styles.css');
const scripts = ['assets/data.js', 'assets/engine.js', 'assets/providers.js', 'assets/app.js'];

const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];

const title = head.match(/<title>([\s\S]*?)<\/title>/)[1];
const meta = head.match(/<meta name="description"[^>]*>/)[0];
const icon = head.match(/<link rel="icon"[^>]*>/)[0];

const bundle = scripts.map(f => '/* ' + f + ' */\n' + read(f)).join('\n');

const inner = body
  .replace(/\n?\s*<script src="assets\/[^"]+"><\/script>/g, '')
  .trimEnd();

/* le nom court sert d'identite a la page hebergee ; le titre complet reste
   celui du site, plus explicite pour un moteur de recherche */
const payload =
  '<title>TravIA</title>\n' +
  meta + '\n' +
  '<style>\n' + css + '</style>\n' +
  inner + '\n' +
  '<script>\nwindow.TravIA = { STANDALONE: true };\n' + bundle + '\n</script>\n';

/* fragment destine a un hebergeur qui fournit lui-meme l'enveloppe HTML */
fs.writeFileSync(path.join(root, 'dist/travia-embed.html'), payload);

/* page complete, ouvrable directement depuis le disque */
fs.writeFileSync(path.join(root, 'dist/travia.html'),
  '<!DOCTYPE html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
  '<meta name="color-scheme" content="light dark">\n' + icon + '\n' +
  payload.replace('<title>TravIA</title>', '<title>' + title + '</title>') + '</html>\n');

const kb = f => (fs.statSync(path.join(root, f)).size / 1024).toFixed(0) + ' ko';
console.log('dist/travia.html      ', kb('dist/travia.html'));
console.log('dist/travia-embed.html', kb('dist/travia-embed.html'));
