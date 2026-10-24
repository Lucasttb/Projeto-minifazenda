# Minha Minifazenda — Recanto do Sol

Jogo de fazenda isométrica para navegador, inspirado nas referências visuais fornecidas. Cenário, interface e ilustrações são originais, desenhados com Canvas e SVG. Não utiliza arquivos ou serviços do jogo da Vostu.

## Desenvolvimento

Requer Python 3 e um navegador moderno. Não precisa instalar dependências, configurar credenciais ou compilar:

```sh
cd /workspace/Projeto-minifazenda
python3 -m http.server 8000 --bind 0.0.0.0
```

Para conferir a sintaxe: `node --check game.js`.

## Jogar

- Escolha milho, cenoura ou morango na barra de sementes ou na loja. O valor é cobrado por canteiro plantado.
- Plante em um canteiro vazio e use o regador para iniciar o crescimento.
- Colha quando estiver maduro. Milho: 20 segundos, custo 5, venda 15, 10 XP. Cenoura: 35 segundos, custo 8, venda 24, 15 XP. Morango: 50 segundos, custo 12, venda 38, 20 XP.
- A cada 100 XP, sobe um nível. Novas fazendas recebem um pequeno conjunto de plantas maduras para experimentar a colheita.
- Arraste o mapa para mover a câmera. Use a roda do mouse ou os botões +/− para aproximar. O botão de casa centraliza a câmera.
- As teclas 1 a 4 selecionam examinar, plantar, regar e colher. Ajuda e Objetivos ficam na lateral esquerda.

O progresso é salvo automaticamente no armazenamento local do navegador e permanece compatível com a primeira versão. Contas, sincronização entre aparelhos, visitas a amigos, construções e criação de animais ainda não foram implementadas. Animais, prédios e trator são decorativos.

## Publicação

GitHub Pages publica a branch `main`, pasta raiz. Atualizações enviadas a essa branch são publicadas no mesmo endereço:

https://lucasttb.github.io/Projeto-minifazenda/

A publicação pode levar alguns minutos. Para reiniciar a fazenda local, remova a chave `minifazenda-save-v1` do armazenamento local do site; essa ação apaga o progresso apenas nesse navegador.
