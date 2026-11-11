# Etapa 3.3.3 — Cadastro de veículos pelo frontend

Entrega de 10/11/2026 para revisão. Escopo limitado ao cadastro manual no estoque.

## Fluxo implementado

1. A tela consulta `GET /api/vehicles/` e `GET /api/stores/` de forma independente.
   Uma falha nas lojas mantém a consulta de estoque utilizável e oferece nova
   tentativa específica para as lojas.
2. **Novo veículo** aparece após confirmar ao menos uma loja com `role: manager`.
   Vendedores e usuários sem vínculo recebem orientação, sem botão de cadastro.
3. O formulário aparece no próprio estoque, com o mesmo painel, campos e botões
   da interface existente. Oferece apenas lojas gerenciadas pelo usuário;
   pré-seleciona a loja se houver uma única opção.
4. O formulário valida os dados, bloqueia submissões simultâneas e envia
   `POST /api/vehicles/` por `apiRequest`, com cookies de sessão e CSRF renovado.
5. Em HTTP 201, fecha o formulário, retorna o foco ao botão, confirma o cadastro,
   limpa os filtros e consulta novamente a página 1. Isso evita esconder o novo
   veículo por causa dos filtros ou da página anteriormente selecionados.
6. Erros de validação aparecem junto aos campos e em um resumo com foco e links.
   Erros gerais e 403 exibem a mensagem da API, preservando os dados. Sessão
   expirada segue o fluxo existente de retorno ao login.
7. Se o POST funcionou, mas a atualização da lista falhou, a confirmação permanece
   e a nova tentativa repete apenas o GET, evitando repetir o cadastro.

## Contrato inspecionado e decisões

Foram lidos os componentes de estoque/login/layout, o cliente HTTP, os serviços
de veículos e lojas, os tipos, os testes existentes, os modelos, serializers,
views, rotas e configurações do DRF. A representação efetiva de
`VehicleSerializer()` também foi consultada pelo shell do Django.

| Campo | Regra existente utilizada |
| --- | --- |
| `store` | Obrigatório no POST; validado em `perform_create`, apesar de somente leitura no serializer. A associação deve ser manager naquela loja. |
| `brand` / `model` | Obrigatórios; até 80 / 100 caracteres; espaços externos removidos. |
| `trim` | Opcional, aceita vazio; até 120 caracteres. |
| `year` | Inteiro, entre 1900 e o ano atual + 1. |
| `mileage` | Inteiro não negativo; zero é permitido. |
| `transmission` / `fuel` | Textos livres opcionais, aceitam vazio; até 30 caracteres cada. Não foram inventados enums. |
| `price` | Decimal positivo, 12 dígitos totais, até 2 casas e 10 dígitos inteiros. |
| `status` | `available`, `reserved`, `sold`; inicial `available`. |
| `stock_type` | `owned`, `consignment`, `wholesale`; inicial `owned`. |

`VehicleCreateInput` distingue campos obrigatórios e opcionais. O preço permanece
string: aceita ponto ou vírgula decimal, sem separadores de milhar, e normaliza
somente a vírgula para ponto antes do POST. Não usa ponto flutuante para montar
o valor enviado. Não envia `id`, `source`, `external_id` ou timestamps.

A trava por ref começa antes do primeiro await, incluindo a obtenção do CSRF.
O estado de carregamento desabilita o fieldset, o envio e o cancelamento. Não há
reenvio automático de POST. Em falha de rede ou HTTP 5xx, a mensagem orienta
conferir o estoque antes de tentar novamente, pois a gravação pode ter ocorrido.

O Django permanece como autoridade sobre permissões e validações. Uma permissão
revogada depois do GET de lojas é rejeitada no POST; um 403 com sessão válida
não desloga o usuário. Não foram alterados modelos, serializers, permissões,
views, rotas ou regras de negócio. Nenhuma migration ou dependência foi criada.

A apresentação usa uma coluna em telas pequenas, duas a partir de `sm` e três
em `xl`. Os campos têm labels, identificação de erros, `aria-invalid` e
`aria-describedby`; o formulário sinaliza carregamento e os resultados usam
status/alert. O foco vai ao título ao abrir, ao resumo ao falhar e ao botão ao
cancelar ou concluir.

## Arquivos criados

- `frontend/src/components/VehicleCreateForm.tsx`: formulário, validação,
  submissão, bloqueio de duplicidade, acessibilidade e apresentação de erros.
- `frontend/src/test/vehicle-create.test.tsx`: testes dos fluxos de cadastro.
- `backend/crm/tests/test_vehicle_creation.py`: testes do contrato e da
  autorização com sessões Django e CSRF reais, em banco isolado.
- `docs/ETAPA3.3.3.md`: este relatório e roteiro de revisão.

## Arquivos modificados

- `frontend/src/pages/InventoryPage.tsx`: consulta de lojas, visibilidade do
  botão, abertura do formulário, confirmação e atualização da lista.
- `frontend/src/services/vehicles.ts`: `createVehicle` sobre o cliente existente.
- `frontend/src/types/api.ts`: tipo do payload de criação.
- `frontend/src/test/app.test.tsx`: mocks existentes passam a responder ao GET
  de lojas, mantendo o escopo dos testes de sessão e consulta de estoque.
- `frontend/README.md` e `README.md`: documentação do novo cadastro e links.

## Verificações executadas

Comandos no PowerShell, com os diretórios de trabalho indicados:

| Diretório | Comando exato | Resultado final |
| --- | --- | --- |
| `frontend/` | `npm run test` | **44 testes passaram**, em 4 arquivos (18 novos testes de cadastro). |
| `frontend/` | `npm run lint` | **Aprovado**, sem erros ou avisos do ESLint. |
| `frontend/` | `npm run build` | **Aprovado**: `tsc -b` e Vite; 1609 módulos transformados, artefatos em `dist/`. |
| `backend/` | `..\.venv\Scripts\python -m pytest -q` | **90 testes passaram** em 148,10 s (32 novos testes de cadastro). |
| `backend/` | `..\.venv\Scripts\python manage.py check` | `System check identified no issues (0 silenced).` |
| `backend/` | `..\.venv\Scripts\python manage.py makemigrations --check --dry-run` | `No changes detected`; nenhuma migration criada. |
| `backend/` | `..\.venv\Scripts\python -m pip check` | `No broken requirements found.` |
| Raiz | `git diff --check` | Aprovado, sem erros de whitespace. Git informa a conversão futura LF → CRLF conforme a configuração local. |

Todos os comandos finais encerraram com código 0. Testes de frontend, lint e
build foram executados duas vezes cada. Na primeira execução, dois casos de
permissão passaram listas diretamente a `it.each`, que as expandiu como
argumentos: a suíte teve 42 aprovações e 2 falhas, e o build apontou TS2740 nesse
mesmo teste. Os casos passaram a usar objetos com a lista no campo `accessible`;
a segunda execução da suíte e do build foi aprovada. Não houve alteração da
implementação para contornar esses testes. As duas execuções do lint passaram.

Comando diagnóstico adicional em `backend/`, concluído com código 0:

```powershell
..\.venv\Scripts\python manage.py shell -c "from crm.inventory.serializers import VehicleSerializer; print(repr(VehicleSerializer()))"
```

Também foram usados `git status --short`, `git diff --stat` e `git diff -- ...`
para revisão local. Nenhuma operação de versionamento ou publicação foi feita.

## Cobertura

Frontend: sucesso com todos os campos; opcionais vazios e padrões; seleção
exclusiva de lojas gerenciadas; vendedor e ausência de vínculos; pré-seleção;
cancelamento e foco; validação local; preço sem arredondamento; erros de campo,
loja e gerais; permissão revogada; sessão expirada durante o POST; rede e 5xx;
submissão duplicada; recuperação da consulta de lojas; falha no GET após sucesso.
Os testes montam a interface em StrictMode e simulam apenas a fronteira Fetch.

Backend: criação mínima e completa com sessão e CSRF, persistência, padrões e
consulta posterior; validações por campo e obrigatoriedade; papel por loja;
revogação; superusuário sem vínculo; ausência ou invalidez de CSRF, origem não
confiável e sessão encerrada. As suítes anteriores também são executadas.

## Limitações e roteiro manual pendente

Não foi realizada inspeção visual em navegador nem teste ponta a ponta contra
os servidores reais. Os testes React usam jsdom e Fetch simulado; os testes
Django usam banco isolado. Nenhum usuário, loja ou veículo de demonstração foi
criado no banco de desenvolvimento.

1. Inicie Django e Vite conforme o README. Prepare usuário manager em uma loja
   e seller em outra, incluindo uma loja gerenciada sem veículos.
2. Entre em `/estoque`, abra **Novo veículo** e confira que somente as lojas
   gerenciadas aparecem. Cadastre com e sem os campos opcionais.
3. Confira confirmação, filtros limpos, primeira página e veículo persistido
   após recarregar. Inspecione o POST com cookie de sessão e `X-CSRFToken`.
4. Teste teclado/Tab, foco, erros e cancelamento em desktop, tablet e largura
   móvel de 360 px, verificando também leitor de tela quando disponível.
5. Entre como seller e como usuário sem vínculo: não deve haver botão de cadastro.
6. Abra o formulário como manager e revogue esse papel no Admin antes de salvar:
   o POST deve retornar 403 sem gravar ou encerrar uma sessão ainda válida.
7. Encerre a sessão em outra aba e tente cadastrar: deve retornar ao login.
8. Simule falha de rede e latência: confira dados preservados, botões bloqueados
   durante o envio e ausência de POST automático repetido. Antes de reenviar
   após resposta perdida, confira se o veículo já foi gravado.

O backend não oferece chave de idempotência: a trava evita envios simultâneos
nesta instância do formulário, mas não impede cadastros independentes em várias
abas ou reenvio manual após resposta perdida. A quilometragem no formulário é
limitada a `Number.MAX_SAFE_INTEGER` (9007199254740991) para evitar perda de
precisão no JSON; o SQLite/DRF admite inteiros maiores. Os papéis são os do
momento da consulta; alterações posteriores continuam sendo verificadas na API.

Sem edição, exclusão, upload de imagens ou avanço à Etapa 3.3.4. Não foram
executados commit, push ou deploy.
