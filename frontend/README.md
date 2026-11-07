# AutoCRM — Etapa 3.2

React 19, TypeScript, Vite 7 e Tailwind CSS 4 conectados ao Django por sessão.
O login e a consulta de Estoque usam a API real. Dashboard e Clientes continuam
preparatórios: seus avisos e indicadores não representam dados consultados.
Não há dados fictícios de fallback nem cadastro de veículos pelo React.

## Iniciar localmente

Pré-requisitos: Python 3.13 e Node.js 22.13+ na série 22, ou 24+; npm.
No PowerShell, a partir da raiz do repositório, prepare o backend:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r backend/requirements-lock.txt
cd backend
..\.venv\Scripts\python manage.py migrate
..\.venv\Scripts\python manage.py createsuperuser
..\.venv\Scripts\python manage.py runserver
```

Se o ambiente e o usuário já existem, basta iniciar o servidor. No Linux/macOS,
use os caminhos equivalentes em `.venv/bin/python`.

No Admin em http://127.0.0.1:8000/admin/, cadastre **Store**, associe o usuário
à loja em **StoreMembership** (seller ou manager) e cadastre veículos reais.
Até superusuários precisam de associação à loja para ler seu estoque pela API.
Usuários ativos comuns podem entrar no React sem acesso ao Admin; um gerente
ou administrador deve preparar suas associações e o estoque.

Em outro terminal, a partir da raiz:

```powershell
cd frontend
npm ci
npm run dev
```

Abra http://127.0.0.1:5173/estoque e entre com usuário e senha do Django.
O login preserva a URL solicitada. Ao recarregar, o React consulta a sessão.
O Django precisa estar em execução. Use `127.0.0.1` consistentemente no React
e no Admin; `localhost` possui cookies próprios.

## Comunicação e autenticação

O proxy de desenvolvimento já existente encaminha `/api` ao Django, por padrão
`http://127.0.0.1:8000`. Pode-se copiar `.env.example` para `.env.local` e alterar
`DJANGO_PROXY_TARGET`. `VITE_API_BASE_URL` aceita um caminho na mesma origem,
como `/api`; URLs externas não são aceitas neste fluxo de sessão. Variáveis
`VITE_*` são públicas e nunca devem conter segredos.

| Método e rota | Contrato |
| --- | --- |
| `GET /api/auth/session/` | `{user: {id, username} ou null, csrfToken}`; também fornece cookie CSRF |
| `POST /api/auth/login/` | JSON `{username, password}`, cookie CSRF e `X-CSRFToken`; retorna sessão |
| `POST /api/auth/logout/` | Cookie CSRF e `X-CSRFToken`; invalida sessão e retorna usuário nulo |
| `GET /api/vehicles/` | Estoque autorizado, com filtros `store`, `brand` exata, `status`, `page` |

`services/api.ts` centraliza Fetch, tipos, cookies, CSRF, cancelamento e erros.
Antes de cada escrita, consulta um token CSRF fresco na sessão. Isso acomoda a
rotação feita pelo Django no login e também um login em outra aba. Os endpoints
de autenticação não usam cache. O cookie de sessão permanece HttpOnly conforme
os padrões do Django; nenhuma senha ou token é gravado em localStorage ou
sessionStorage. A senha é limpa após a tentativa de login.

O Django usa `SessionAuthentication` e `IsAuthenticated`. Seu DRF devolve 403
quando falta sessão e também quando faltam permissões. Depois de 401/403 em um
recurso protegido, o cliente consulta a sessão: se não há usuário, desmonta as
telas protegidas e solicita novo login com aviso de expiração; se há usuário,
mostra o erro de acesso e mantém a sessão. Uma senha incorreta no login gera
mensagem própria, sem aviso indevido de sessão expirada. Falhas de rede, proxy,
consulta da sessão e logout apresentam erros com possibilidade de repetir.

O proxy troca o Host para o do Django e preserva Origin. Por isso,
`CSRF_TRUSTED_ORIGINS` aceita somente `http://127.0.0.1:5173` e
`http://localhost:5173` por padrão quando DEBUG está ativo. Para outro endereço,
configure `DJANGO_CSRF_TRUSTED_ORIGINS` no ambiente do processo Django com URLs
completas separadas por vírgulas. No PowerShell, antes de iniciar o Django:

```powershell
$env:DJANGO_CSRF_TRUSTED_ORIGINS = 'http://127.0.0.1:5173,http://localhost:5173'
```

Não foi desativada a proteção CSRF nem adicionada liberação de CORS. O login é
uma view Django protegida mesmo quando o usuário ainda é anônimo. Só usar a
verificação de CSRF do DRF no login deixaria essa proteção incompleta.

Referência de CSRF: [documentação do Django](https://docs.djangoproject.com/en/5.2/ref/csrf/).
Proxy: [documentação do Vite](https://vite.dev/config/server-options#server-proxy).

## Estoque e paginação

A resposta DRF é `{count, next, previous, results}`, com 20 itens por página.
A tela usa `count` e a presença de `next`/`previous` para navegação. As chamadas
continuam relativas ao proxy, incrementando ou decrementando `page`; não seguem
as URLs absolutas que o Django pode gerar com a porta 8000. Filtros novos voltam
à página 1. Mudanças de consulta cancelam pedidos anteriores, evitando exibir
resultados atrasados. A tela não conserva dados de uma consulta anterior quando
começa outra; mostra carregamento, resultado, vazio ou erro separadamente.

Os cards mostram somente campos existentes no serializer: marca, modelo, versão,
ano, quilometragem, câmbio, combustível, preço, disponibilidade, tipo de estoque
e ID da loja. Não há nome de loja nem foto no contrato atual. Campos opcionais
vazios são identificados como não informados. `price` permanece string no
contrato e é convertido apenas para apresentação em reais.

O backend continua limitando a leitura às associações do usuário. Filtros não
ampliam esse acesso. Escritas permanecem limitadas a gerentes da loja. Uma lista
vazia significa apenas ausência de veículos acessíveis nos filtros atuais.
Sem associação à loja, o resultado também será vazio. Nenhum modelo, serializer,
permissão de recurso ou regra de negócio foi alterado.

## Verificar

Dentro de `frontend/`:

```powershell
npm test
npm run lint
npm run build
npm run test:watch
npm audit
npm audit --omit=dev
```

`npm test` executa Vitest, Testing Library e jsdom. Os testes de interface montam
a aplicação em StrictMode e simulam a fronteira Fetch; as fixtures existem
somente nos arquivos de teste. Não substituem uma verificação visual em navegador.
`build` também checa TypeScript nos testes e na configuração do Vitest.

Dentro de `backend/`, onde está `pytest.ini`:

```powershell
..\.venv\Scripts\python -m pytest -q
..\.venv\Scripts\python manage.py check
..\.venv\Scripts\python manage.py makemigrations --check --dry-run
..\.venv\Scripts\python -m pip check
```

Os novos testes de backend usam sessões reais com `enforce_csrf_checks=True`,
sem `force_authenticate`, e um banco de testes isolado. Verificam login, logout,
rotação do CSRF, origens, usuário inativo, isolamento entre lojas e paginação.
Consulte os resultados finais no [relatório da entrega](../docs/ETAPA3.2.md).

## Roteiro manual

1. Inicie os dois servidores e abra `/estoque` sem sessão: deve aparecer login.
2. Informe senha incorreta: confira a mensagem e que a senha foi limpa.
3. Entre com usuário associado a uma loja com veículos reais. Confira os cards
   com os registros do Django, valores em reais e estados de disponibilidade.
4. Aplique marca exata, ID da loja e status; confirme retorno à página 1.
   Com mais de 20 veículos acessíveis, avance e retorne pelas páginas.
5. Consulte com filtros sem resultados e com usuário sem associação a lojas:
   confira o estado vazio. Um usuário de outra loja não deve ver seu estoque.
6. Saia pelo React e confira que os dados desaparecem. Entre novamente e
   recarregue `/estoque`: a sessão deve ser reconhecida sem um novo login.
7. Com o estoque aberto, saia pelo Admin em outra aba do mesmo host, ou remova
   o cookie `sessionid` nas ferramentas do navegador. Clique em Filtrar estoque:
   deve aparecer aviso de sessão expirada e novo login, sem os cards anteriores.
8. Pare o Django e consulte o estoque ou recarregue a página. Confira o erro,
   reinicie o Django e use Tentar novamente. Um erro não deve parecer lista vazia.
9. Nas ferramentas de rede, confira login/logout por POST com `X-CSRFToken`;
   sem esse cabeçalho ou com Origin não confiável, o Django deve rejeitar o POST.
10. Em 360 px, tablet e desktop, confira cards, filtros, botões, menu móvel,
    navegação por Tab, foco visível e fechamento do menu por Escape.

## Produção e escopo

`npm run build` gera `dist/`. `npm run preview` serve apenas esse build para
inspeção e não configura o proxy de `/api` usado no desenvolvimento. A publicação
precisa servir o frontend e encaminhar `/api` na mesma origem, com fallback das
rotas do React para `index.html`, preservando as rotas do backend. HTTPS, segredos,
cookies seguros e demais configurações de produção pertencem à implantação.

A identidade visual anterior foi mantida: marinho `#0d2039`, azul `#004a8c`,
fundo neutro, sidebar e menu móvel. Não foram implementados CRUD pela interface,
consulta de clientes, indicadores do Dashboard, Kanban, distribuição de leads,
Radar, relatórios avançados ou WhatsApp. Não há CI nem E2E em navegador nesta
entrega; a suíte React usa DOM simulado e a suíte Django usa banco de testes.
