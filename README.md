# Compras Inteligente Sync Corrigido

Versão corrigida do app com foco em uso real no mercado.

## O que foi melhorado
- sincronização preparada corretamente para dois celulares via Firebase
- modo supermercado enxuto
- mostra só os itens faltantes
- filtro por categoria no mercado
- busca fixa no topo do mercado
- opção de ocultar itens já comprados
- registro simples de quem marcou/desmarcou item
- dashboard com resumo
- 73 produtos da planilha
- edição completa dos itens
- exportação da lista
- calculadora
- instalável como app no celular

## Como publicar
1. Suba todos os arquivos para a raiz do repositório
2. Vá em Settings > Pages
3. Escolha Deploy from a branch
4. Selecione main e /(root)
5. Salve

## Para usar em dois celulares ao mesmo tempo
1. Abra `firebase-config.js`
2. Troque `enabled: false` para `enabled: true`
3. Preencha:
   - projectId
   - apiKey
   - authDomain
   - databaseURL
   - appId
4. Use o mesmo `shoppingListId` nos dois celulares

Sem Firebase, o app funciona só em modo local.
