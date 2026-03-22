import path from 'path';
import { Configuration } from 'webpack';

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
  target: 'webworker',
  optimization: {
    minimize: true,
  },
};

export default config;
