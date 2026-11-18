# Rotina — Atendimento Interno

Sistema web responsivo para organizar o atendimento de um escritório de contabilidade. Registra o que aconteceu no dia, acompanha pendências e facilita a passagem de turno entre atendentes.

Os dados são compartilhados entre os computadores pelo Supabase. Cada atendente acessa o sistema com seu próprio login.

## Funcionalidades

- Visão diária dos atendimentos, pendências e tarefas concluídas.
- Cadastro de atendimento com cliente, descrição, data, responsável, prioridade, status e observação.
- Passagem de turno com recados datados e identificados por atendente.
- Atividade recente para acompanhar as atualizações.
- Nomes da equipe e escala editáveis no próprio sistema.
- Ciclo de ausência configurável: três dias de cobertura a cada quinze dias.
- Layout responsivo para computador e celular.
- Login individual e dados compartilhados em banco Supabase com regras de acesso.

## Tecnologias

- HTML, CSS e JavaScript.
- Supabase Auth para login.
- Supabase/PostgreSQL para armazenamento compartilhado.
- Supabase Realtime para atualizar os registros entre computadores.

## Estrutura dos arquivos

| Arquivo | Para que serve |
| --- | --- |
| `index.html` | Estrutura da aplicação e telas de login e cadastro. |
| `styles.css` | Aparência e adaptação para telas menores. |
| `app.js` | Ações da aplicação e conexão com o Supabase. |
| `config.js` | URL e chave pública do projeto Supabase. |
| `config.example.js` | Modelo de configuração para outro projeto. |
| `schema.sql` | Tabelas, permissões, regras de acesso e atualização em tempo real. |
| `.nojekyll` | Permite publicar os arquivos estáticos pelo GitHub Pages. |

## Configuração do Supabase

Este projeto já está preparado para o Supabase. Para ligar a aplicação ao banco do escritório:

1. Crie ou selecione um projeto no [Supabase Dashboard](https://supabase.com/dashboard).
2. Abra **SQL Editor → New query** e execute o conteúdo do arquivo `schema.sql`.
3. Em **Authentication → Users**, crie uma conta para cada atendente. Mantenha o cadastro público desativado.
4. Copie o UID de cada conta e cadastre os usuários autorizados no SQL Editor. Substitua os exemplos pelos UIDs e nomes corretos:

   ```sql
   insert into public.team_members (user_id, display_name) values
     ('UUID-DO-PRIMEIRO-ATENDENTE', 'Nome do primeiro atendente'),
     ('UUID-DO-SEGUNDO-ATENDENTE', 'Nome do segundo atendente')
   on conflict (user_id) do update
   set display_name = excluded.display_name;
   ```

5. Em **Project Settings → API Keys**, copie a URL do projeto e a chave **Publishable**. Coloque-as em `config.js` nos campos `supabaseUrl` e `supabaseKey`.

O arquivo `config.js` deste pacote já contém a conexão do projeto Supabase configurado para esta instalação. Para conectar outro projeto, use os valores dele. A chave **Publishable** é feita para uso no navegador. As tabelas deste projeto usam Row Level Security (RLS) para restringir o acesso aos usuários cadastrados em `team_members`.

> Nunca coloque a chave secreta `service_role`, senhas ou outras credenciais privadas no código ou no GitHub.

## Publicação no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie o **conteúdo desta pasta** para a raiz do repositório. O arquivo `index.html` deve ficar na raiz. Inclua também os arquivos ocultos `.gitignore` e `.nojekyll`.
3. No repositório, acesse **Settings → Pages** e escolha a branch principal e a pasta `/ (root)` como origem da publicação.
4. Quando o GitHub Pages mostrar o endereço do site, copie-o.
5. No Supabase, abra **Authentication → URL Configuration**. Configure o endereço publicado em **Site URL** e adicione-o também em **Redirect URLs**.
6. Abra o site publicado nos dois computadores e entre com os logins individuais.

## Como usar

1. Entre com seu e-mail e senha.
2. Na visão do dia, selecione a data desejada e clique em **Novo atendimento**.
3. Preencha a descrição e os demais campos. Use **Observação para a equipe** para deixar contexto para o próximo turno.
4. Marque a tarefa como concluída quando resolver o atendimento.
5. Use **Passagem de turno** para registrar recados gerais do dia.
6. Em **Configurações**, ajuste os nomes da equipe e a data do próximo ciclo de ausência.

## Segurança e dados

- Não há cadastro público. Uma conta só acessa os dados depois de ser adicionada à tabela `team_members`.
- O acesso às tabelas é protegido por políticas RLS definidas em `schema.sql`.
- O site usa a chave Publishable do Supabase; não use a chave secreta no navegador.
- Os dados ficam no banco Supabase e não são sincronizados por `localStorage`.

## Execução local

Para testar localmente, sirva a pasta por um servidor web local e mantenha `config.js` preenchido. Para compartilhar o sistema entre computadores, publique a página em um endereço HTTPS, como o GitHub Pages, e configure a URL no Supabase.
