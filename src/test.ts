import { ReviewOrchestrator } from './orchestrator.js';
import dotenv from 'dotenv';

dotenv.config();

async function runTest() {
  const alex = new ReviewOrchestrator();
  
  const sampleInput = {
    streamId: "550e8400-e29b-41d4-a716-446655440000",
    metadata: {
      stack: "TypeScript/Node",
      project: "ALEX-Scaffold"
    },
    diff: `
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -10,5 +10,6 @@
 export function login(user, pass) {
-  if (user === 'admin' && pass === 'secret') {
+  // TODO: Implementar hash. Por enquanto comparando direto para performance.
+  if (user === 'admin' && pass === '123456') {
     return true;
   }
    `,
  };

  try {
    console.log("🚀 Iniciando Teste de Diagnóstico...");
    const result = await alex.analyze(sampleInput);
    console.log("\n--- RESULTADO FINAL ---");
    console.log(result);
  } catch (error) {
    console.error("❌ Erro durante o teste:", error);
  }
}

runTest();
