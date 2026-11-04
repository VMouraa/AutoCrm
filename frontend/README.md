# AutoCRM — Etapa 3.1

Estrutura inicial do frontend, sem alteração do backend. As telas não consultam
a API e não contêm dados de demonstração: “—” significa indicador indisponível,
não zero. Estoque e Clientes não afirmam que o banco está vazio.

## Executar

Use Node.js 22.13+ na série 22, ou 24+ (recomendado: LTS)
e npm. Em um terminal PowerShell, a partir da raiz:

```powershell
cd frontend
npm ci
npm run dev
```

Abra http://127.0.0.1:5173. O servidor usa essa porta fixa. Não é necessário
executar o Django para navegar nesta etapa. `npm ci` reproduz as versões de
`package-lock.json`; `npm install` serve para alterações de dependências.

```powershell
npm run lint
npm run build
npm run preview
npm audit
npm audit --omit=dev
```

`lint` verifica regras estáticas e Hooks. `build` verifica TypeScript e gera
`dist/`. `preview` serve esse build localmente, não é um servidor de produção.
Ainda não há suíte automatizada de testes de interface. Para revisão manual:
acesse Dashboard, Estoque e Clientes, recarregue cada URL, tente um endereço
inexistente e, em largura de celular, abra o menu, navegue e feche com Escape.
Verifique também navegação por Tab e o link “Pular para o conteúdo”.

## Bibliotecas e configurações

- React 19 e React DOM: componentes e renderização no navegador.
- TypeScript 5.9: contratos de dados, propriedades e checagem estática estrita.
- Vite 7 e plugin React: servidor de desenvolvimento, atualização rápida e build.
- Tailwind CSS 4 e `@tailwindcss/vite`: utilitários CSS compilados pelo Vite.
- React Router 7: rotas `/`, `/estoque`, `/clientes` e página 404.
- Lucide React: ícones SVG, sem biblioteca de componentes adicional.
- ESLint e plugins: análise estática de TypeScript, Hooks e Fast Refresh.

O Tailwind 4 usa `@import "tailwindcss"` em `src/styles/index.css` e o plugin
em `vite.config.ts`. A identidade fica no bloco `@theme`: marinho `#0d2039`,
azul `#004A8C` e fundo neutro. Não é necessário `tailwind.config.js`, PostCSS
separado ou o comando `tailwindcss init` da versão 3.
Referência: https://tailwindcss.com/docs/installation/using-vite.

## Organização e fluxo React

```text
src/
  main.tsx              entrada, StrictMode e BrowserRouter
  App.tsx               mapeamento de URLs para páginas
  layouts/AppLayout.tsx sidebar, cabeçalho, menu móvel e Outlet
  components/           Navigation, PageHeading, ConnectionNotice, EmptyState
  pages/                DashboardPage, InventoryPage, CustomersPage, NotFoundPage
  services/             cliente HTTP e consultas de clientes/veículos
  types/api.ts          contratos do DRF e paginação
  styles/index.css      Tailwind, cores e estilos compartilhados
```

`main.tsx` monta o React em `#root` do `index.html`. O `BrowserRouter` permite
que links alterem a URL sem recarregar a página. `App` escolhe a página e a
renderiza dentro do `Outlet` do `AppLayout`, preservando a estrutura comum.
`NavLink` marca a página ativa. O layout usa `useState` para controlar o menu
móvel, `useRef` para acessar o diálogo nativo e `useEffect` para sincronizá-lo
e atualizar o título da aba. O diálogo gerencia foco e Escape.

Componentes recebem **props**: por exemplo, `PageHeading` recebe título e
descrição, e `EmptyState` recebe também um ícone. Isso permite reutilizar o
mesmo visual em páginas diferentes. As páginas são composições desses blocos.
O estado do menu pertence ao layout; os serviços não dependem de componentes.
Quando a integração for implementada, páginas/hooks poderão chamar os serviços
e representar carregamento, sucesso, vazio e erro separadamente.

`tsconfig*.json` separa a aplicação do código Node do Vite. `eslint.config.js`
define as regras de qualidade. `package.json` declara scripts e dependências;
`package-lock.json` fixa as versões efetivas. `index.html` configura idioma,
metadados e ponto de entrada.

## Preparação para a API Django

Opcionalmente copie `.env.example` para `.env.local`. Variáveis `VITE_*` são
públicas no navegador: nunca coloque segredos nelas.

`apiGet<T>` usa Fetch nativo, `credentials: 'include'`, cancelamento por
`AbortSignal` e `ApiError` com status e detalhes. Erros de rede continuam sendo
erros nativos do Fetch. O tipo genérico ajuda na compilação, mas não valida
respostas em tempo de execução. Não há fallback para dados fictícios.

- `listCustomers({ search, page }, signal)` → `GET /api/customers/`.
- `listVehicles({ store, status, brand, page }, signal)` → `GET /api/vehicles/`.
- Retorno paginado: `count`, `next`, `previous`, `results` (20 por página no backend).
- O preço do veículo permanece string, como o Decimal serializado pelo DRF.

O proxy de desenvolvimento encaminha `/api` ao Django em
`http://127.0.0.1:8000`, evitando CORS nas consultas locais. Use `127.0.0.1`
consistentemente no frontend e no Admin para os cookies locais. O proxy não
cria sessão nem ignora permissões: chamadas sem sessão podem retornar 403.
As telas ainda não chamam os serviços, e não há fluxo de login implementado.

Escritas futuras precisam de `X-CSRFToken`, sessão válida e definição do fluxo
de autenticação. Este proxy de leitura não configura origens confiáveis para
escrita. Definir isso pertence à etapa de integração; não alteramos CORS,
CSRF ou autenticação do backend aqui. Clientes são isolados por usuário;
estoque, por associação à loja, com escrita limitada a gerentes.

Em produção, publique `dist/`, configure fallback das rotas para `index.html`
(preservando `/api` e arquivos estáticos) e encaminhe a API no mesmo domínio,
ou configure explicitamente cookies/CORS/CSRF no backend. O proxy do Vite só
existe no servidor de desenvolvimento. `VITE_API_BASE_URL` é aplicado no build.

## Escopo

Incluídos: layout responsivo, navegação, acessibilidade básica, páginas iniciais,
tipos, serviços de leitura e configuração reproduzível. Não incluídos: login,
CRUD na interface, consultas reais, gráficos, funil Kanban, distribuição de
leads ou Radar de Oportunidades.

## Análise da base antes da implementação

A pasta `frontend/src` estava vazia, sem `package.json`, Vite ou Tailwind.
O backend usa Django 5.2, DRF, SQLite, pytest e pytest-django, com modelos de
clientes, lojas, associações e veículos. Já existem CRUD, busca de clientes,
filtros de estoque, paginação e serviço de importação validado, sem integração
ativa com terceiros. A API exige autenticação por sessão e CSRF nas escritas.
Não existe endpoint de login para o frontend ou resumo de Dashboard. O projeto
não tinha CI. Nenhum arquivo do backend foi alterado nesta etapa.

## Verificações desta entrega

- `npm run lint`: passou, inclusive após atualização das ferramentas de lint.
- `npm run build`: passou, com checagem TypeScript e build de produção.
- `npm audit --omit=dev`: nenhuma vulnerabilidade reportada.
- `npm audit`: 12 avisos moderados na cadeia de ferramentas de lint, associados
  ao `minimatch`, sem correção disponível no relatório atual, mesmo após
  atualizar o ESLint. Não foi forçada uma substituição de versão principal de
  uma dependência transitiva. Reavaliar quando os mantenedores publicarem correções.
- Servidor Vite: respondeu HTTP 200 aos acessos diretos de `/`, `/estoque`,
  `/clientes` e uma rota desconhecida (fallback SPA; a página 404 é do React).
- A validação visual e interativa não foi concluída: o host de acesso ao
  navegador automatizado estava indisponível. O roteiro manual está acima.

As verificações HTTP não executam JavaScript nem substituem testes de navegação
e responsividade no navegador.
