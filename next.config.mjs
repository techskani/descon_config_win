/** @type {import('next').NextConfig} */
const nextConfig = {
    // Electronアプリでは静的エクスポートを使用しない
    // output: 'export',
    trailingSlash: true,
    skipTrailingSlashRedirect: true,
    // distDir はデフォルトの .next を使用（out にすると起動時の EPERM が発生しやすい）
    images: {
      unoptimized: true
    },

    // SWCを無効にしてBabelを使用
    swcMinify: false,
    experimental: {
      forceSwcTransforms: false
    },

    // webpack: (config) => {
    //   config.module.rules.push({
    //     test: /\.y?aml$/,  // 正規表現で、.yamlまたは.ymlファイルを対象とする
    //     type: 'asset/source',  // asset/sourceタイプを使用して、ファイルの内容をソースコードとして取り込む
    //   })
    //   return config;  // 変更されたWebpack設定を返す
    // },
  };

export default nextConfig;
