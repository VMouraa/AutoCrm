# AutoCRM — Etapa 3.3.2: API de lojas e permissões

## Contrato

`GET /api/stores/` exige uma sessão Django autenticada e retorna uma lista JSON
sem paginação, ordenada pelo nome da loja e, em caso de empate, pelo ID:

```json
[
  { "id": 1, "name": "Loja A", "role": "manager" },
  { "id": 2, "name": "Loja B", "role": "seller" }
]
```

Os valores acima são ilustrativos. `id` identifica a loja, não a associação.
`role` é o papel do usuário autenticado naquela loja. Cada loja aparece uma vez,
conforme a unicidade de `(store, user)` já existente em `StoreMembership`.

- A consulta parte de `StoreMembership`, filtrada por `request.user`.
- `select_related("store")` carrega as informações da loja na mesma consulta.
- Não depende de veículos: lojas com estoque vazio também são retornadas.
- Sem associação, retorna HTTP 200 e `[]`, inclusive para superusuários.
- Usuários sem sessão recebem HTTP 403, conforme `SessionAuthentication` atual.
- Somente GET, HEAD e OPTIONS são aceitos. HEAD não tem corpo de resposta.
- POST, PUT, PATCH, DELETE e TRACE retornam 405 para usuários autenticados com
  os requisitos de CSRF atendidos. Sem CSRF, escritas podem ser recusadas antes
  com 403 pela autenticação de sessão existente.
- Não existe rota `/api/stores/{id}/` nem filtro por usuário, loja ou página.
  Parâmetros de consulta não ampliam o acesso.

## Arquivos

Modificados:

- `backend/crm/inventory/serializers.py`: `StoreAccessSerializer`, com ID e nome
  da loja e papel da associação, todos somente leitura.
- `backend/crm/inventory/views.py`: `StoreListView`, com autenticação obrigatória,
  métodos limitados e paginação desativada apenas para esta consulta.
- `backend/crm/urls.py`: rota nomeada `store-list` em `/api/stores/`.
- `frontend/src/types/api.ts`: tipos `StoreRole` e `Store`.
- `frontend/README.md`: contrato e referência a este roteiro.

Criados:

- `backend/crm/tests/test_stores.py`: testes de acesso, papéis, métodos e contrato.
- `frontend/src/services/stores.ts`: `listStores(signal?): Promise<Store[]>`.
- `frontend/src/services/stores.test.ts`: contrato do serviço, sessão, conexão e
  cancelamento usando o cliente HTTP existente.
- `docs/ETAPA3.3.2.md`: esta documentação.

Nenhum modelo, migração, configuração de autenticação, cliente HTTP central,
layout ou formulário foi alterado. O serviço está preparado para integração
futura com seletores de loja; nenhuma chamada nova foi adicionada à página.
Nenhuma dependência foi instalada e nenhum commit ou push foi realizado.

## Testes e verificações

| Verificação | Resultado |
| --- | --- |
| Backend: `python -m pytest -q` | 58 passaram: 41 existentes e 17 novos |
| Frontend: `npm run test` | 26 passaram: 22 existentes e 4 novos |
| `npm run lint` | Aprovado |
| `npm run build` | TypeScript e Vite aprovados |
| `python manage.py check` | Sem problemas |
| `python manage.py makemigrations --check --dry-run` | Nenhuma alteração detectada |

Lint e build foram executados fora do sandbox após autorização, pois o Node
recebeu EPERM ao acessar seu diretório de instalação dentro do sandbox.

A suíte de lojas usa sessão real com `APIClient(enforce_csrf_checks=True)`.
Abrange gerente, vendedor, papéis distintos em várias lojas, lojas compartilhadas,
lojas vazias, isolamento entre usuários, ausência de vínculo, superusuário sem
associação, autenticação de GET/HEAD/OPTIONS, métodos proibidos, lista com mais de
20 lojas, ausência de rota de detalhe e remoção de vínculo entre consultas.

O serviço frontend testa GET com cookies na mesma origem e `AbortSignal`, os
papéis retornados, lista vazia, expiração de sessão, falha de rede e cancelamento.
Fetch é simulado apenas nos testes; o serviço da aplicação usa a API real.

Comandos, em `backend/`:

```powershell
..\.venv\Scripts\python -m pytest -q
..\.venv\Scripts\python manage.py check
..\.venv\Scripts\python manage.py makemigrations --check --dry-run
```

Em `frontend/`:

```powershell
npm run test
npm run lint
npm run build
```

## Teste manual

1. Com o ambiente existente, inicie o Django a partir de `backend/` usando
   `..\.venv\Scripts\python manage.py runserver` e o React a partir de
   `frontend/` usando `npm run dev`.
2. No Admin, prepare um usuário com papel manager em uma loja e seller em outra.
   Uma das lojas pode permanecer sem veículos. Prepare também uma loja vinculada
   exclusivamente a outro usuário.
3. Entre pelo React em `http://127.0.0.1:5173/estoque`. No console do navegador,
   execute:

   ```javascript
   fetch('/api/stores/', { credentials: 'same-origin' })
     .then(response => response.json()).then(console.log)
   ```

4. Confira ID, nome e papel das duas lojas, incluindo a loja sem veículos.
   A loja exclusiva do outro usuário não deve aparecer.
5. Confira HEAD com
   `fetch('/api/stores/', { method: 'HEAD' }).then(response => console.log(response.status, response.headers.get('Allow')))`.
   Deve retornar 200 e anunciar GET, HEAD e OPTIONS.
6. Para confirmar 405 em uma escrita sem alterar dados, forneça um token CSRF
   válido no mesmo console:

   ```javascript
   const session = await fetch('/api/auth/session/').then(response => response.json())
   const response = await fetch('/api/stores/', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json', 'X-CSRFToken': session.csrfToken },
     body: '{}',
   })
   console.log(response.status, response.headers.get('Allow'))
   ```

7. Saia pelo React e repita o GET: deve retornar 403 sem dados de lojas.
   Repita autenticado como usuário sem vínculo e superusuário sem vínculo:
   ambos devem receber HTTP 200 e `[]`.

## Limites e riscos

- A lista não é paginada para entregar todas as opções de seleção. Volumes muito
  altos de associações por usuário podem exigir busca e paginação no futuro.
- Os papéis representam o estado no momento da consulta. Escritas futuras devem
  continuar autorizadas no backend, mesmo que a interface já tenha carregado
  uma permissão que depois foi revogada.
- Esta etapa não adiciona permissões ao superusuário, gerenciamento de lojas,
  formulários ou cadastro de veículos pelo React.
- A validação automatizada não substitui uma verificação em navegador conectado
  ao ambiente real. Não foram criados usuários ou lojas no banco local durante
  esta entrega; os testes usam banco isolado.
