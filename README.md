# AutoCRM — CRM para revendas de veículos

Backend em desenvolvimento com Django REST Framework e SQLite. Frontend
em React, TypeScript, Vite e Tailwind CSS, com autenticação por sessão e
consulta real do estoque. Dashboard e Clientes mantêm telas preparatórias.
Consulte [como executar e entender o frontend](frontend/README.md).

## Arquitetura

Monólito modular. `backend/config/` contém configurações e rotas globais.
`backend/crm/` contém clientes, serializers, views, rotas, admin, testes e migrações.
`backend/crm/inventory/` contém modelos, serializer, view e serviço de importação
para lojas e veículos. Os modelos de estoque são reexportados em `crm/models.py`
para descoberta pelo Django; inventory não é um app separado.

## Instalação e execução

PowerShell, a partir da raiz, com Python 3.13:

```powershell
python -m venv .venv
.venv\Scripts\python -m pip install -r backend/requirements-lock.txt
cd backend
..\.venv\Scripts\python manage.py migrate
..\.venv\Scripts\python manage.py createsuperuser
..\.venv\Scripts\python manage.py runserver
```

No Linux/macOS use `.venv/bin/python` com o caminho relativo correspondente.
Não é necessário gerar migrações para iniciar o projeto.
O ambiente desta revisão está em `.venv/` na raiz; o banco em `backend/db.sqlite3`.

Acesse http://127.0.0.1:8000/admin/ e autentique-se. A API usa sessão e exige
CSRF para escritas. Cadastre Store e StoreMembership pelo Admin; não existem
endpoints de gerenciamento de lojas/associações.

Em outro terminal, a partir da raiz, com Node.js 22.13+ (série 22) ou 24+:

```powershell
cd frontend
npm ci
npm run dev
```

Abra http://127.0.0.1:5173/estoque e entre com o usuário criado no Django.
Não é necessário entrar pelo Admin antes de usar o React. Mesmo um superusuário
precisa de uma **StoreMembership** para consultar os veículos de uma loja na API.
Cadastre veículos pelo Admin ou pelos recursos existentes da API; a interface
desta etapa é de consulta. Não são criados dados de demonstração.

### Autenticação do React

- `GET /api/auth/session/`: retorna `{user, csrfToken}`; `user` é nulo sem sessão
  ou contém somente `id` e `username`. Também fornece o cookie CSRF.
- `POST /api/auth/login/`: JSON com `username` e `password`, cookie CSRF e
  cabeçalho `X-CSRFToken`. Retorna a sessão e um token CSRF após sua rotação.
- `POST /api/auth/logout/`: exige CSRF e invalida a sessão no servidor.
- O cliente usa Fetch na mesma origem e cookies de sessão do Django (HttpOnly).
  Senhas ficam apenas no formulário durante a tentativa de login; não há
  persistência de senhas, tokens ou sessão em localStorage/sessionStorage.
- O proxy existente do Vite encaminha `/api` para `127.0.0.1:8000`. O Django
  confia nas origens locais `http://127.0.0.1:5173` e `http://localhost:5173`
  quando DEBUG está ativo, preservando a verificação CSRF. Para outra origem,
  configure `DJANGO_CSRF_TRUSTED_ORIGINS` no ambiente do processo Django,
  com URLs completas separadas por vírgulas. Não há liberação de CORS.
- O DRF retorna 403 tanto sem sessão quanto por falta de permissão. O cliente
  consulta a sessão após 401/403: sem usuário, remove os dados protegidos e
  solicita novo login; com usuário válido, exibe o erro de acesso.

Use `127.0.0.1` consistentemente ao alternar entre React e Admin. O proxy
de desenvolvimento não existe em produção: publique frontend e `/api` na mesma
origem, com HTTPS e configuração própria do Django. O preview do Vite serve
somente arquivos do build e não substitui essa infraestrutura.

### Verificação da Etapa 3.2

Execute os testes do Django **dentro de `backend/`**, onde está `pytest.ini`:

```powershell
cd backend
..\.venv\Scripts\python -m pytest -q
..\.venv\Scripts\python manage.py check
..\.venv\Scripts\python manage.py makemigrations --check --dry-run
..\.venv\Scripts\python -m pip check
```

Em outro terminal, dentro de `frontend/`:

```powershell
npm test
npm run lint
npm run build
```

Roteiro manual, contratos, arquivos e resultados estão em
[frontend/README.md](frontend/README.md) e no
[relatório da Etapa 3.2](docs/ETAPA3.2.md).

## API e isolamento

- `/api/customers/` e `/api/customers/{id}/`: CRUD por usuário autenticado,
  busca por nome, telefone e interesse; responsável imutável pela API.
- `/api/vehicles/` e `/api/vehicles/{id}/`: membros leem veículos das próprias
  lojas; apenas gerentes da loja do veículo podem criar, alterar ou excluir.
- Estoque aceita filtros `store`, `status` e `brand`. Paginação: 20 itens.
- `store` é obrigatório na criação e ignorado na atualização, preservando o
  vínculo original. Origem e referência externa são somente leitura na API.
- `upsert_external_vehicle` exige gerente e identifica veículos por
  `(store, source, external_id)`. A referência pode se repetir em lojas distintas.

**Limitação:** clientes são isolados por usuário, sem vínculo com loja. Não há
isolamento por loja para clientes, inclusive quando um usuário participa de várias
lojas. Isso exige definição de regras e migração de dados, fora desta revisão.

O Django Admin tem permissões globais de staff/modelo; os filtros da API não se
aplicam automaticamente a ele. Operadores que dependem de isolamento por loja
não devem receber acesso administrativo global.

## Revisão da base — 28/10/2026

Ambiente instalado: Python 3.13.1, Django 5.2.18, DRF 3.18.3, pytest 9.2.0 e
pytest-django 4.14.0. Migrações iniciais geradas e aplicadas com sucesso no SQLite.
Nenhuma funcionalidade nova foi implementada.

Arquivos alterados/criados e motivos:

- `backend/crm/inventory/views.py`: IDs de loja inválidos no cadastro e filtro
  retornam 400, evitando falhas de conversão e overflow.
- `backend/crm/inventory/importers.py`: valida pelo serializer e pelo modelo antes
  do upsert. Rejeita números não finitos, escolhas inválidas, comprimentos, ano,
  preço e quilometragem inválidos; normaliza preço para Decimal e preserva dados
  existentes em caso de falha.
- `backend/crm/tests/test_inventory.py`: corrigida comparação Decimal/string;
  testes de acesso cruzado, funções por loja, atualização/exclusão, IDs inválidos,
  validação e atomicidade de importação e referências em lojas distintas.
- `backend/crm/tests/test_customers.py`: regressões de alteração/exclusão por
  outro usuário e impossibilidade de trocar responsável pela API.
- `backend/crm/migrations/0001_initial.py` e `__init__.py`: esquema reproduzível,
  restrições de unicidade e dependência do modelo de usuário.
- `backend/requirements-lock.txt`: versões exatas instaladas. `requirements.txt`
  mantém os intervalos aceitos pelo projeto.
- `.gitignore`: exclui ambiente virtual, banco local, caches e `.env`.
- `README.md` e `backend/README-ETAPA2.md`: documentação de instalação e limites.

Verificações, a partir de `backend/`:

```powershell
..\.venv\Scripts\python -m pytest -q
..\.venv\Scripts\python manage.py check
..\.venv\Scripts\python manage.py makemigrations --check --dry-run
..\.venv\Scripts\python -m pip check
```

## Limitações restantes

Configuração de desenvolvimento: DEBUG ativo por padrão, chave de fallback,
SQLite e validadores de senha vazios. Produção requer configuração própria,
segredos, HTTPS, backups e revisão de permissões. Não há CI configurado.
Transições de status seguem as opções do modelo, sem regras comerciais extras.
Importação não possui interface nem integração ativa com terceiros.
Consulta de clientes pelo React, indicadores do Dashboard, funil, negociações,
distribuição de leads, notificações, Radar e relatórios permanecem planejados.

O projeto contém repositório Git. Inclua migrações e lockfiles no versionamento.

Resultado da Etapa 3.2: **41 testes do backend e 22 do frontend passaram**;
lint e build aprovados; manage.py check sem problemas; nenhuma alteração de
modelo sem migração; pip check sem dependências quebradas. Instalação limpa com
`npm ci` e conferência HTTP do proxy aprovadas. Auditoria: zero vulnerabilidades
em produção e dez avisos moderados nas ferramentas de lint. Validação local,
sem CI, E2E em navegador ou teste em produção. Detalhes em
[docs/ETAPA3.2.md](docs/ETAPA3.2.md).
