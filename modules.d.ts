declare namespace NodeJS {
  export interface ProcessEnv {
    DATABASE_URL: string
    PORT: string
    SESSION_SECRET: string
    JWT_SECRET: string
    GOOGLE_CLIENT_ID: string
    GOOGLE_CLIENT_SECRET: string
  }
}
