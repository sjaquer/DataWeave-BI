---
Date: 2025-10-07
---

# ðŸ”“ REGLAS TEMPORALES PARA SEED

## âš ï¸ IMPORTANTE: SOLO PARA DESARROLLO - ELIMINAR DESPUÃ‰S DEL SEED

### Paso 1: Copiar estas reglas en Firebase Console

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Firestore Database** â†’ **Reglas**
4. **Copia y pega** las reglas de abajo
5. Haz clic en **Publicar**

---

## ðŸ“ Reglas Temporales (Copiar esto)

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // REGLAS TEMPORALES PARA SEED - SOLO PARA DESARROLLO
    // âš ï¸ NO USAR EN PRODUCCIÃ“N
    
    // Permitir escritura en users sin autenticaciÃ³n (solo para seed)
    match /users/{userId} {
      allow read, write: if true;
    }
    
    // Reglas normales para otras colecciones
    match /shopify_orders/{orderId} {
      allow read, write: if request.auth != null;
    }
    
    match /inventory_movements/{movementId} {
      allow read, write: if request.auth != null;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

### Paso 2: Ejecutar el seed

DespuÃ©s de publicar las reglas temporales, ejecuta:

```bash
npx tsx scripts/seed-users-client.ts
```

---

### Paso 3: Restaurar reglas de producciÃ³n

Una vez que el seed se complete exitosamente, **INMEDIATAMENTE** restaura las reglas seguras.

Copia el contenido de `docs/FIRESTORE-RULES-UPDATED.md` y pÃ©galo en Firebase Console.

---

## â±ï¸ Tiempo estimado: 2 minutos

1. Copiar reglas temporales â†’ Firebase Console (30 seg)
2. Ejecutar seed (30 seg)
3. Restaurar reglas de producciÃ³n (1 min)

---

## âœ… VerificaciÃ³n

DespuÃ©s del seed, verifica en Firebase Console â†’ Firestore â†’ users:
- Debes ver 4 documentos
- Cada uno con: uid, email, role, displayName, createdAt

---

**Â¡Listo! Sigue los pasos en orden.** ðŸš€

