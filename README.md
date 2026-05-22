# Gestão Atendimento Parceiros Vegas

Portal web para gestão de atendimentos especiais de empresas parceiras da Vegas Card.

## Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Supabase** (Auth + PostgreSQL + RLS)
- **Vercel** (deploy)

---

## Setup local

### 1. Clonar o repositório

```bash
git clone https://github.com/seu-usuario/Gest-o-Atendimento-Parceiros-Vegas.git
cd Gest-o-Atendimento-Parceiros-Vegas
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

Copie o arquivo de exemplo e preencha com suas chaves do Supabase:

```bash
cp .env.local.example .env.local
```

Edite `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
```

> As chaves estão em: **Supabase Dashboard → Settings → API**

### 4. Banco de dados

Execute o arquivo `vegas_supabase_schema.sql` no SQL Editor do Supabase.

### 5. Primeiro usuário (gestor master)

No Supabase Dashboard → **Authentication → Users → Add user**:
- Preencha e-mail e senha
- Depois no **SQL Editor**, atualize o perfil:

```sql
UPDATE public.users_profile
SET role = 'gestor_master', full_name = 'Seu Nome'
WHERE email = 'seu@email.com';
```

### 6. Rodar localmente

```bash
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

---

## Deploy na Vercel

### 1. Conectar repositório

- Acesse [vercel.com](https://vercel.com)
- **New Project → Import Git Repository**
- Selecione `Gest-o-Atendimento-Parceiros-Vegas`

### 2. Configurar variáveis de ambiente na Vercel

Em **Settings → Environment Variables**, adicione:

| Nome | Valor |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` |

### 3. Deploy

Clique em **Deploy**. A cada `git push` na branch `main`, a Vercel faz deploy automático.

---

## Estrutura do projeto

```
src/
├── app/
│   ├── (auth)/login/         → Tela de login
│   ├── (portal)/
│   │   ├── dashboard/        → Painel principal
│   │   ├── atendimentos/     → Lista + novo + detalhe
│   │   ├── empresas/         → Lista + detalhe
│   │   ├── parceiros/        → Fase 2
│   │   ├── relatorios/       → Fase 2
│   │   └── usuarios/         → Admin
│   └── globals.css
├── components/
│   ├── layout/Sidebar.tsx
│   ├── tickets/              → StatusBadge, TicketActions, TicketHistoryPanel
│   └── companies/
├── contexts/AuthContext.tsx
├── lib/
│   ├── supabase/             → client.ts + server.ts
│   ├── types.ts
│   ├── constants.ts
│   └── utils.ts
└── middleware.ts              → Proteção de rotas
```

---

## Roadmap

| Fase | Módulos |
|------|---------|
| ✅ Fase 1 | Login, Dashboard, Empresas, Atendimentos (criar/ver/atualizar), Histórico, SLA |
| 🔲 Fase 2 | Fila por departamento, SLA com alertas, Relatórios, Parceiros |
| 🔲 Fase 3 | WhatsApp Business API, Evolution API, IA triagem |
| 🔲 Fase 4 | App mobile, push notifications, BI avançado |

---

## Perfis de acesso

| Perfil | Permissões |
|--------|-----------|
| `gestor_master` | Acesso total — lê, edita, exclui, gerencia usuários |
| `supervisor_adm` | Acompanha atendimentos, altera status, distribui demandas |
| `atendimento` | Abre e atualiza chamados próprios |
| `parceiro` | Vê apenas empresas e tickets da própria carteira |
| `empresa_cliente` | Abre e acompanha solicitações (fase futura) |
