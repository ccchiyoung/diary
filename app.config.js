// 호스팅 위치에 따라 웹 base 경로를 환경변수로 결정.
// - Vercel(루트 도메인): EXPO_PUBLIC_BASE_PATH 미설정 → '' (루트)
// - GitHub Pages(/diary): EXPO_PUBLIC_BASE_PATH=/diary
module.exports = ({ config }) => {
  const basePath = process.env.EXPO_PUBLIC_BASE_PATH || '';
  return {
    ...config,
    experiments: {
      ...(config.experiments || {}),
      baseUrl: basePath,
    },
  };
};
