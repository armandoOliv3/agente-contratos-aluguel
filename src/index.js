// Sobe o servidor. Uso: npm start  (PORT e HOST opcionais)
import { criarServidor } from './servidor.js'

const app = criarServidor({ logger: true })

try {
  await app.listen({ port: Number(process.env.PORT ?? 3000), host: process.env.HOST ?? 'localhost' })
} catch (erro) {
  app.log.error(erro)
  process.exit(1)
}
