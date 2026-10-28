# AutoCRM — Etapa 2: Estoque

Backend Django REST Framework com lojas, associações e veículos.
Consulte o [README principal](../README.md) para instalação, revisão de arquitetura,
lista de correções e resultados dos testes.

Após instalar dependências e aplicar as migrações incluídas, crie Store e
StoreMembership com função manager pelo Django Admin. A API usa sessão e CSRF.

- GET /api/vehicles/: estoque das lojas do usuário.
- POST /api/vehicles/: gerente da loja informada.
- GET /api/vehicles/{id}/: membro da loja.
- PUT/PATCH/DELETE /api/vehicles/{id}/: gerente da loja do veículo.
- Filtros: store, status, brand.

O serviço upsert_external_vehicle valida os campos com serializer e modelo,
exige gerente e usa loja/origem/ID externo como chave de importação.
Não há integração ativa com terceiros nem interface de importação.
Clientes continuam isolados por usuário, sem relação com loja.
O Admin possui permissões globais e não replica os filtros da API.
SQLite e configurações atuais destinam-se a desenvolvimento.
