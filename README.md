# DayFlow 🌿

Gerenciador de tarefas diárias com jardim de foco — deploy no Vercel + Supabase.

## Deploy em 5 minutos

### 1. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) → **New Project**
2. Anote a **Project URL** e a **anon public key** (Settings → API)
3. Vá em **SQL Editor → New Query**, cole o conteúdo de `supabase/schema.sql` e clique **Run**

### 2. ⚠️ Configuração crítica — desabilitar confirmação de e-mail

Para que o login com senha funcione **imediatamente** (sem exigir clique em e-mail de confirmação):

1. Supabase Dashboard → **Authentication → Providers → Email**
2. **Desative** a opção `"Confirm email"`
3. Clique **Save**

> Sem isso, novos usuários precisariam confirmar o e-mail antes de entrar.

### 3. Configurar o index.html

Abra `index.html` e substitua nas duas linhas indicadas:

```js
const SUPABASE_URL      = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'sua-anon-key-aqui';
```

### 4. Subir no GitHub

```bash
git init
git add .
git commit -m "feat: DayFlow"
git remote add origin https://github.com/SEU-USUARIO/dayflow.git
git push -u origin main
```

### 5. Deploy no Vercel

1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Importe o repositório do GitHub
3. Clique **Deploy** — pronto!

---

## Autenticação (e-mail + senha)

- Tela de login com abas **Entrar** / **Criar conta**
- "Esqueci a senha" envia link de redefinição por e-mail
- Avatar do usuário no canto superior direito com opção de **Sair**
- **Login persistente**: ao salvar o link como app na tela inicial do celular, o app lembra da sessão automaticamente — não precisa logar de novo
- Cada usuário vê e edita apenas seus próprios dados (Row Level Security)

---

## Adicionar como app no celular

**iPhone/iPad (Safari):**
1. Abra o link no Safari
2. Toque em **Compartilhar** → **Adicionar à Tela de Início**
3. Confirme → toque no ícone na tela inicial → já entra direto na conta

**Android (Chrome):**
1. Abra o link no Chrome
2. Menu (3 pontos) → **Adicionar à tela inicial**
3. Confirme → abre direto na conta

---

## Estrutura do projeto

```
dayflow/
├── index.html       # App completo (HTML + CSS + JS)
├── vercel.json      # Config de deploy estático
├── supabase/
│   └── schema.sql   # Schema do banco (execute no Supabase)
└── README.md
```

## Recursos

- **Supabase Realtime**: alterações no celular aparecem no desktop em tempo real
- **Fallback offline**: sem internet, funciona com localStorage e sincroniza ao reconectar
- **Sessão persistente**: token renovado automaticamente, sem precisar logar de novo
