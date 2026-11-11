# Etapa 3.3.4 — Edição de veículos e gerenciamento de status

Entrega de 10/11/2026 para revisão local, sem publicação.

## Implementação

O estoque oferece **Editar** somente nos cards cuja loja consta no GET de lojas
com papel `manager` para o usuário atual. Ser gerente de uma loja não habilita
edição nos cards de outra loja em que o usuário é `seller`. Sem consulta de lojas
bem-sucedida, as ações de escrita permanecem indisponíveis.

O formulário de cadastro foi renomeado para `VehicleForm` e reutilizado para
edição, preservando validações, estilos, responsividade, CSRF, apresentação de
erros e prevenção de submissões simultâneas. A edição recebe os campos completos
do card autorizado, preenchendo marca, modelo, versão, ano, quilometragem,
câmbio, combustível, preço, status e tipo de estoque. A loja aparece somente
para leitura e não integra o payload de atualização.

O formulário calcula as diferenças em relação ao veículo aberto e usa PATCH.
Se apenas o status mudar, envia apenas `{"status": "sold"}`, por exemplo.
Nenhuma alteração resulta em orientação no formulário, sem requisição de escrita.
O preço continua string até a API, aceitando vírgula ou ponto decimal, sem
separador de milhar. Câmbio e combustível continuam textos livres opcionais.

Após salvar, a confirmação informa o status retornado pelo servidor e a tela
consulta novamente o estoque com os filtros e a página atuais. Um veículo que
deixou de atender aos filtros sai da listagem. Se o DRF retornar 404 para uma
página maior que 1 que deixou de existir, a tela recua uma página e repete o GET,
mantendo os filtros. Isso também permite recuperar paginação invalidada por
alterações feitas em outra sessão. O cadastro mantém seu fluxo anterior:
confirmação, filtros limpos e retorno à página 1.

O status usa texto e cores distintas no card: disponível (azul), reservado
(âmbar) e vendido (cinza). Nenhum novo status ou regra de transição foi criado.

## Contrato e segurança

Antes das alterações foram inspecionados componentes de estoque e formulário,
serviços, tipos, cliente HTTP, modelos, serializers, ViewSet, rotas, configurações
de autenticação/permissões e testes de cadastro, estoque, sessão e lojas.

| Endpoint | Utilização |
| --- | --- |
| `GET /api/stores/` | Papéis específicos do usuário em cada loja; ações de escrita ficam restritas às lojas manager. |
| `GET /api/vehicles/` | Consulta autorizada e atualização da lista, com `store`, `brand`, `status` e `page`. |
| `GET /api/auth/session/` | Cliente existente obtém CSRF antes das escritas e distingue sessão expirada de permissão negada. |
| `POST /api/vehicles/` | Cadastro existente preservado. |
| `PATCH /api/vehicles/{id}/` | Edição e alteração de status com somente os campos modificados. |

O router existente também oferece `PUT /api/vehicles/{id}/`; seu contrato e
permissões foram testados, mas a interface usa PATCH. Nenhuma rota foi criada.
Os endpoints de login e logout continuam funcionando pelo cliente já existente.

Enums confirmados no modelo e serializer:

- `status`: `available`, `reserved`, `sold`.
- `stock_type`: `owned`, `consignment`, `wholesale`.

As validações existentes foram mantidas: comprimentos 80/100/120 para
marca/modelo/versão, até 30 para câmbio e combustível, ano entre 1900 e o próximo
ano, quilometragem inteira não negativa e preço positivo com até 10 dígitos
inteiros e 2 casas decimais. A UI preserva o limite de inteiros seguros do
JavaScript para quilometragem, já adotado no cadastro.

`VehicleUpdateInput` omite a loja e os campos somente leitura. O backend também
mantém a loja imutável: entradas como `store`, `source`, `external_id`, `id` e
timestamps são ignoradas pelo serializer. Não foi alterado esse contrato para
transformar entradas ignoradas em erros. A permissão usa a loja original, nunca
a loja enviada por um cliente.

O queryset do Django restringe o acesso às lojas vinculadas: veículo de loja
externa retorna 404, sem dados do registro. Um seller em loja acessível recebe
403 ao tentar alterar, mesmo sendo manager em outra loja. Revogação ou remoção
de vínculo continua sendo validada pelo servidor.

Não foram alterados modelos, serializers, views, permissões, regras de negócio,
dependências ou migrations.

## Estados e acessibilidade

- A trava de envio começa antes de obter o CSRF e impede submissões repetidas.
  Campos, salvar e cancelar ficam desabilitados durante a escrita. Enquanto há
  um formulário aberto, os botões para abrir outro cadastro/edição ficam bloqueados.
- Erros 400 aparecem nos campos e em resumo com links e foco; os valores ficam
  preservados para correção e nova tentativa.
- Um 403 mantém a sessão válida e mostra a mensagem da API. Um 404 durante a
  edição orienta cancelar e consultar novamente, sem expor dados de outra loja.
- Sessão expirada segue o fluxo de login existente, removendo a tela protegida.
- Rede e 5xx preservam o formulário e orientam conferir se a gravação ocorreu.
  Não há repetição automática de PATCH/POST.
- Se o GET posterior à gravação falhar, a confirmação permanece e a nova tentativa
  repete apenas a consulta.
- Abertura leva foco ao título; cancelamento retorna ao botão de origem. Após
  salvar, se o botão tiver saído do DOM durante a atualização, o foco vai à seção
  de estoque. Labels, erros associados, `aria-busy`, alert e status são preservados.
- O formulário mantém uma coluna no móvel, duas em `sm` e três em `xl`.

## Arquivos

Criados:

- `frontend/src/test/vehicle-edit.test.tsx`: testes de interface e integração
  pela fronteira Fetch, em StrictMode.
- `backend/crm/tests/test_vehicle_update.py`: contrato, segurança, validações
  e paginação, com sessão Django e CSRF real em banco isolado.
- `docs/ETAPA3.3.4.md`: este relatório e roteiro manual.

Renomeado e modificado:

- `frontend/src/components/VehicleCreateForm.tsx` →
  `frontend/src/components/VehicleForm.tsx`: formulário compartilhado de cadastro
  e edição. O arquivo antigo foi substituído, sem manter uma cópia duplicada.

Modificados:

- `frontend/src/pages/InventoryPage.tsx`: ações por loja, formulário único,
  confirmação, atualização com filtros/página, recuperação de página inválida e cores de status.
- `frontend/src/services/vehicles.ts`: `updateVehicle(id, data)` por PATCH.
- `frontend/src/types/api.ts`: tipo `VehicleUpdateInput` sem campos imutáveis.
- `frontend/README.md` e `README.md`: documentação do fluxo de edição.

## Testes e verificações

Comandos executados no PowerShell, com seus diretórios de trabalho:

| Diretório | Comando exato | Resultado |
| --- | --- | --- |
| `frontend/` | `npm run test` | **64 testes passaram** em 5 arquivos, incluindo os 20 novos casos de edição e os 18 de cadastro existentes. |
| `frontend/` | `npm run lint` | **Aprovado**, sem erros ou avisos do ESLint. |
| `frontend/` | `npm run build` | **Aprovado**, TypeScript e Vite; 1609 módulos transformados, build em `dist/`. |
| `backend/` | `..\.venv\Scripts\python -m pytest -q` | **128 testes passaram** em 116,74 segundos, incluindo 38 novos casos de atualização. |
| `backend/` | `..\.venv\Scripts\python manage.py check` | `System check identified no issues (0 silenced).` |
| `backend/` | `..\.venv\Scripts\python manage.py makemigrations --check --dry-run` | `No changes detected`; nenhuma migration criada. |
| Raiz | `git diff --check` | Aprovado, sem erros de whitespace; Git apenas informa futura conversão LF → CRLF conforme a configuração local. |

As suítes completas, lint, build e verificações do Django passaram na primeira
execução desta etapa, com código de saída 0. Foram usados também
`git status --short`, `git diff --stat` e leitura do diff para revisão local.
O estado inicial do repositório estava limpo. Nenhuma instalação de dependência,
mutação no banco de desenvolvimento ou operação de publicação foi realizada.

O frontend cobre abertura preenchida, loja somente leitura, cancelamento e foco,
todos os campos editáveis, PATCH com CSRF e cookies, atualização de cada status,
ausência de alterações, validações locais e da API, correção após erro,
rede/5xx/403/404, papéis por loja, envio duplicado, sessão expirada, filtros e
página 2, saída do filtro, página invalidada e falha no GET posterior à escrita.
A suíte anterior de cadastro é executada sem alterações em seus testes.

O backend cobre PATCH e PUT, campos editáveis e imutáveis, alteração isolada de
status, validações sem mutação, seller/manager por loja, acesso cruzado,
revogação/remoção de vínculo, superusuário sem associação, sessão/CSRF/origem e
paginação filtrada após mudar status. As suítes anteriores também são executadas.

## Limitações

- Não foi feito teste visual ou ponta a ponta em navegador com os dois servidores
  reais. O frontend usa jsdom e Fetch simulado; o backend usa banco isolado.
- Os dados iniciais são os da última consulta do estoque. Não há bloqueio otimista
  por versão no contrato atual: alterações concorrentes no mesmo campo podem
  sobrescrever a outra edição. PATCH evita reenviar campos não alterados.
- Os papéis da UI refletem a consulta de lojas; o Django revalida a autorização
  em cada escrita, inclusive depois de mudanças de permissão.
- Falha de rede pode ocorrer depois de o servidor gravar. A interface preserva
  os dados e orienta consultar o estoque antes de repetir; não existe confirmação
  distribuída nem chave de idempotência no contrato atual.
- O limite de quilometragem da UI é `Number.MAX_SAFE_INTEGER`, como no cadastro.
- Não há exclusão, imagens, edição em lote ou novas regras de transição de status.

## Roteiro de validação manual

1. Inicie Django em `backend/` com `..\.venv\Scripts\python manage.py runserver`
   e Vite em `frontend/` com `npm run dev`. Use o mesmo host, por exemplo
   `http://127.0.0.1:5173/estoque`.
2. Prepare no Admin um usuário manager na loja A e seller na loja B, além de
   veículo em loja externa sem vínculo. Entre pelo React: somente os cards da
   loja A devem oferecer **Editar**; nenhum veículo externo deve aparecer.
3. Abra a edição. Confira todos os campos preenchidos e loja somente leitura.
   Cancele e confira o foco no botão de origem, sem requisição de escrita.
4. Edite campos e salve. Confira PATCH em `/api/vehicles/{id}/` com cookies,
   `X-CSRFToken`, preço em texto e apenas diferenças, sem loja. Recarregue e
   confira persistência, confirmação e valores no card.
5. Altere somente status: disponível → reservado → vendido → disponível. Confira
   PATCH contendo somente status e texto/cor correspondente após salvar.
6. Aplique filtros de marca, loja e status e avance à página 2, com mais de 20
   itens. Edite um campo que mantenha os filtros: a página e filtros devem persistir.
7. Altere status ou marca para fora do filtro. O card deve sair da listagem e a
   confirmação deve permanecer. Se a última página ficar inválida, confira recuo
   à anterior; se a página 1 ficar vazia, confira o estado vazio.
8. Teste campos obrigatórios vazios, ano, quilometragem e preço inválidos. Confira
   mensagens, foco no resumo e preservação dos valores. Corrija e salve novamente.
9. Com a edição aberta, revogue o papel de manager no Admin: a gravação deve
   retornar 403. Remova o vínculo: deve retornar 404 sem dados do registro.
   Tentar alterar ID de veículo de loja externa também deve retornar 404.
10. Encerre a sessão em outra aba e salve: deve aparecer login com aviso de expiração.
11. Simule latência e falha de rede: confira bloqueio de envios repetidos,
    preservação de dados e ausência de repetição automática. Se o PATCH tiver
    sucesso mas o GET falhar, **Tentar novamente** deve enviar somente GET.
12. Confira teclado/Tab, labels, foco, mensagens e layout em 360 px, tablet e
    desktop. Refaça um cadastro para confirmar que seu fluxo foi preservado.

Sem commit, push, deploy ou avanço para outra etapa. Aguardando revisão do usuário.
