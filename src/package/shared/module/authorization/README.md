# Authorization core

Catálogo em código, avaliação ALL/ANY com default deny e contexto imutável via
AsyncLocalStorage. Não depende de HTTP, identidade externa, tenancy ou ORM.
`Permission.role.create` é um literal tipado; uma string desconhecida nunca concede acesso.
`RequestContexts.current()` falha fora de uma execução autorizada.
Consulte [o guia de segurança](../../../../../docs/authorization.md).
