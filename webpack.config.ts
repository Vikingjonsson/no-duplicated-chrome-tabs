import fs from 'fs';
import path from 'path';
import { Compiler, Configuration } from 'webpack';

class CopyExtensionAssetsPlugin {
  apply(compiler: Compiler): void {
    compiler.hooks.afterEmit.tap('CopyExtensionAssetsPlugin', () => {
      const dist = path.resolve(__dirname, 'dist');
      const manifestSrc = path.resolve(__dirname, 'manifest.json');
      const manifestDest = path.join(dist, 'manifest.json');
      if (fs.existsSync(manifestSrc)) {
        fs.copyFileSync(manifestSrc, manifestDest);
      }
      const iconsSrc = path.resolve(__dirname, 'icons');
      const iconsDest = path.join(dist, 'icons');
      if (fs.existsSync(iconsSrc)) {
        fs.cpSync(iconsSrc, iconsDest, { recursive: true });
      }
    });
  }
}

const config: Configuration = {
  mode: 'production',
  entry: './src/background.ts',
  output: {
    filename: 'background.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [new CopyExtensionAssetsPlugin()],
  target: 'webworker',
  optimization: {
    minimize: true,
  },
};

export default config;
