# Entrega — Etapa 3.2: React + Django

## Resultado e decisões

- Login, logout, consulta de sessão e rotas protegidas no React. A URL solicitada
  é preservada durante o login. Credenciais não são persistidas no navegador.
- Endpoints JSON em `/api/auth/` foram necessários porque a base só oferecia o
  login HTML do Admin. Usam autenticação e sessão nativas do Django, proteção
  CSRF inclusive para login anônimo e respostas sem cache.
- O proxy de desenvolvimento do Vite já existia e foi aproveitado. O cliente
  trabalha na mesma origem, sem CORS. Origens CSRF locais foram adicionadas ao
  Django somente em DEBUG por padrão; há configuração por variável de ambiente.
- Cliente HTTP centralizado com tipos, cookies, CSRF fresco antes de escritas,
  cancelamento, erros de conexão e distinção entre expiração e falta de permissão.
  Como SessionAuthentication retorna 403 nos dois casos, o cliente confirma a
  sessão antes de pedir novo login. As permissões existentes foram preservadas.
- Estoque consulta `/api/vehicles/`, apresenta os campos reais do serializer,
  filtros existentes e paginação DRF de 20 itens. As URLs absolutas de paginação
  não são seguidas: a consulta relativa usa `page`, preservando o proxy.
- Estados separados de carregamento, resultado, vazio e erro, com repetição.
  As consultas anteriores são canceladas ao trocar página ou filtros.
- Identidade visual, sidebar e navegação móvel da Etapa 3.1 preservadas.
  Dashboard e Clientes continuam identificados como áreas preparatórias.
- Nenhuma alteração em modelos, serializers, regras comerciais, permissões de
  recursos ou migrações. Nenhuma funcionalidade fora do escopo foi implementada.

Referências técnicas consultadas: [CSRF do Django](https://docs.djangoproject.com/en/5.2/ref/csrf/)
e [proxy do Vite](https://vite.dev/config/server-options#server-proxy).

## Arquivos criados

| Arquivo | Finalidade |
| --- | --- |
| `backend/crm/auth_views.py` | Endpoints JSON de sessão, login e logout |
| `backend/crm/tests/test_auth.py` | 17 casos com sessão e CSRF reais no banco de testes |
| `frontend/src/auth/context.ts` | Contrato do estado de autenticação e hook |
| `frontend/src/auth/AuthProvider.tsx` | Consulta inicial e ciclo da sessão |
| `frontend/src/auth/RequireSession.tsx` | Proteção das rotas e repetição da consulta |
| `frontend/src/pages/LoginPage.tsx` | Formulário e aviso de sessão expirada |
| `frontend/src/services/auth.ts` | Serviço tipado de autenticação |
| `frontend/src/services/api.test.ts` | Testes do cliente HTTP e CSRF |
| `frontend/src/test/app.test.tsx` | Fluxos de autenticação e estoque em StrictMode |
| `frontend/src/test/setup.ts` | Configuração DOM e limpeza entre testes |
| `frontend/vitest.config.ts` | Configuração da suíte frontend |
| `docs/ETAPA3.2.md` | Este relatório |

## Arquivos modificados

| Arquivo | Alteração |
| --- | --- |
| `README.md` | Inicialização integrada, contratos e autenticação |
| `backend/config/settings.py` | Origens CSRF locais e configuração por ambiente |
| `backend/crm/urls.py` | Rotas de autenticação adicionais |
| `frontend/.env.example` | Explicação de mesma origem e configuração CSRF |
| `frontend/README.md` | Execução, decisões, limites e roteiro manual |
| `frontend/package.json` | Scripts e dependências de testes |
| `frontend/package-lock.json` | Versões reproduzíveis das dependências |
| `frontend/tsconfig.node.json` | Checagem da configuração de testes |
| `frontend/src/App.tsx` | Provider de autenticação e rotas protegidas |
| `frontend/src/components/ConnectionNotice.tsx` | Avisos coerentes com o escopo integrado |
| `frontend/src/components/EmptyState.tsx` | Badge configurável para consulta concluída |
| `frontend/src/layouts/AppLayout.tsx` | Usuário atual, logout e seu tratamento de erro |
| `frontend/src/pages/DashboardPage.tsx` | Indicadores identificados como pendentes |
| `frontend/src/pages/InventoryPage.tsx` | Estoque real, filtros, paginação e estados |
| `frontend/src/services/api.ts` | Cliente HTTP centralizado e proteção da sessão |
| `frontend/src/styles/index.css` | Campos e botões com os estilos existentes |
| `frontend/src/types/api.ts` | Tipos de usuário e sessão |

## Testes e verificações executados

| Verificação | Resultado |
| --- | --- |
| Backend: `python -m pytest -q`, dentro de `backend/` | **41 passaram** (24 existentes + 17 novos), 105,83 s |
| `python manage.py check` | Sem problemas |
| `python manage.py makemigrations --check --dry-run` | Nenhuma alteração de modelo |
| `python -m pip check` | Sem dependências quebradas |
| Frontend: `npm ci` sem flags especiais | Instalação limpa pelo lockfile concluída |
| `npm run test`, Vitest 4.1.12 | **22 passaram**, 2 arquivos, 10,36 s |
| `npm run lint` | Passou sem erros ou avisos |
| `npm run build` | TypeScript e Vite 7.3.7 passaram |
| `npm audit --omit=dev` | **0 vulnerabilidades** |
| `npm audit` | **10 moderadas**, 0 altas e 0 críticas; cadeia de ferramentas de lint |
| `git diff --check` | Sem erros de whitespace |
| HTTP pelo proxy Vite → Django real | SPA 200; sessão 200 e no-store; estoque anônimo 403; login sem CSRF 403; credenciais inválidas com CSRF 401; Origin externo 403; logout com CSRF 200 |

Backend: sessão anônima, dados mínimos de usuário, headers de cache, cookies,
login válido/inválido, usuário inativo, JSON inválido, métodos HTTP, CSRF antes
e depois do login, rotação de token, rejeição de origens externas, origens do
Vite, invalidação e impossibilidade de reutilizar sessão após logout. A consulta
usa sessão real, com paginação, filtros e isolamento de lojas; uma negativa de
escrita ao vendedor não encerra sua sessão. Os testes novos usam
`APIClient(enforce_csrf_checks=True)`, sem forçar autenticação.

Frontend: fluxo de login até estoque e logout, senha incorreta, limpeza da senha,
ausência de persistência de credenciais, restauração da sessão, expiração, erro
ao consultar sessão, erro no logout, carregamento do estoque, campos formatados,
paginação, filtros e retorno à página 1, lista vazia, falha de rede, HTTP 500 e
403 com sessão válida, repetição de consulta, requisição cancelada, resposta
HTML de proxy e CSRF renovado. Fetch é simulado somente nos testes.

Também foram iniciados temporariamente Vite e Django e verificados por HTTP
real através da porta 5173, com cookie jar e Origin do frontend. Essa conferência
não criou usuários, associações nem veículos no banco local; login positivo e
estoque autorizado foram verificados com sessões reais no banco de testes.

## Problemas identificados e limites

- A base não tinha endpoints JSON de autenticação. Foram adicionados sem
  modificar o modelo de sessão ou as permissões dos recursos.
- O serializer de veículos não fornece foto nem nome de loja. A tela usa os
  campos disponíveis e identifica a loja pelo ID.
- O npm 11.2.0 local falhou internamente ao resolver peers opcionais durante a
  atualização do Vitest. A atualização foi concluída com `--legacy-peer-deps` e
  `@testing-library/dom` explícito. Depois, **`npm ci` normal passou**, seguido
  dos testes, lint e build. Não é necessário usar essa flag para instalar o projeto.
- A versão inicial do executor de testes trouxe alertas corrigíveis; foi
  atualizada para Vitest 4.1.12. A auditoria final contém dez alertas moderados
  na cadeia de lint já presente (ESLint, typescript-eslint e minimatch). Não foi
  aplicada troca forçada de versão principal nem override de dependência transitiva.
- A suíte de interface usa jsdom; não houve validação visual em navegador nem
  E2E autenticado em navegador com o banco local. O roteiro manual inclui
  responsividade e navegação por teclado. Os testes Django usam banco isolado.
- Dashboard e Clientes mantêm telas preparatórias. Administração de usuários,
  associações e veículos continua pelos recursos existentes do backend/Admin.
- O proxy do Vite é de desenvolvimento. A publicação requer mesma origem para
  frontend e API, configuração de produção do Django e HTTPS.

## Executar e revisar manualmente

O [README principal](../README.md) apresenta a preparação do ambiente. Para quem
já tem dependências instaladas e migrações aplicadas, a partir da raiz:

```powershell
# Terminal 1
cd backend
..\.venv\Scripts\python manage.py runserver
```

```powershell
# Terminal 2
cd frontend
npm ci
npm run dev
```

Abra http://127.0.0.1:5173/estoque e entre com usuário ativo do Django. Prepare
Store, StoreMembership e veículos reais pelo Admin quando necessário. Mesmo
superusuários precisam de associação para consultar o estoque na API.

O [roteiro manual completo](../frontend/README.md#roteiro-manual) cobre login,
filtros, mais de 20 veículos, usuário de outra loja, vazio, logout, expiração,
servidor desligado, CSRF e larguras de celular, tablet e desktop.

## Sugestão de commit

```text
feat: integra autenticação por sessão e estoque React à API Django
```

Nenhum commit ou push foi realizado.
