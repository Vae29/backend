export const JWT_CONFIG = {
  ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET || 'agrogestion_access_secret_dev_key_2024',
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || 'agrogestion_refresh_secret_dev_key_2024',
  ACCESS_TOKEN_EXPIRES: '15m',      // Access token válido 15 minutos
  REFRESH_TOKEN_EXPIRES: '7d',      // Refresh token válido 7 días
};
