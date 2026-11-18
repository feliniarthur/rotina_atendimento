# Rotina — atendimento interno

Aplicativo web responsivo para dois atendentes de um escritório contábil. Registra atendimentos e pendências, cliente, prioridade, status, observações de passagem de turno e uma escala com ciclo de ausência de três dias a cada quinze dias.

## Conteúdo do projeto

- `index.html`, `styles.css`, `app.js`: aplicativo web.
- `schema.sql`: tabelas PostgreSQL e regras de acesso do Supabase.
- `config.js`: configuração pública do banco; vem com valores de exemplo.
- `config.example.js`: modelo de configuração.
- `.nojekyll`: mantém os arquivos estáticos disponíveis no GitHub Pages.

## Preparar o banco Supabase

1. Crie um projeto em [supabase.com/dashboard](https://supabase.com/dashboard).
2. No **SQL Editor**, execute todo o conteúdo de `schema.sql`.
3. Em **Authentication → Users**, crie uma conta por atendente. Mantenha o cadastro público desativado.
4. Copie o UUID de cada conta e cadastre os dois usuários autorizados no SQL Editor:

   ```sql
   insert into public.team_members (user_id, display_name) values
     ('UUID-DO-PRIMEIRO-ATENDENTE', 'Nome do primeiro atendente'),
     ('UUID-DO-SEGUNDO-ATENDENTE', 'Nome do segundo atendente');
   ```

5. Em **Project Settings → API Keys**, copie a URL do projeto e a chave `publishable` (ou a chave pública `anon` dos projetos antigos). Coloque esses valores em `config.js`.

O navegador precisa receber a URL e a chave pública para conectar ao Supabase. Elas são destinadas ao cliente web; as regras RLS do `schema.sql` restringem os dados às contas cadastradas. **Nunca coloque a chave secreta `service_role`, senhas ou outra credencial privada em `config.js` ou no GitHub.**

## Publicar pelo GitHub Pages

1. Crie um repositório no GitHub.
2. Envie os arquivos desta pasta para a raiz do repositório; `index.html` deve ficar na raiz.
3. No repositório, abra **Settings → Pages** e publique a partir da branch principal e da pasta `/ (root)`.
4. Copie o endereço publicado. No Supabase, abra **Authentication → URL Configuration** e inclua esse endereço em **Site URL** e em **Redirect URLs**.
5. Abra o endereço nos dois computadores e entre com as duas contas criadas.

O projeto não está ligado a um banco real até que as etapas do Supabase sejam feitas e os dados de `config.js` sejam preenchidos. A tela fica protegida pelo login enquanto essa conexão não estiver configurada.

## Usar no computador

Guarde esta pasta no computador. Para editar os arquivos, use qualquer editor de texto ou de código. Para testar a versão online, publique-a no GitHub Pages; abrir o arquivo HTML diretamente não conecta os dois computadores por si só.
