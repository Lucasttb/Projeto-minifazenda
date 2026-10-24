# Minha Minifazenda — Recanto do Sol

Jogo de fazenda isométrica para navegador, com começo pequeno e progressão por colheitas, moedas e experiência. As referências visuais orientam o estilo; os objetos de uma fazenda avançada não são entregues no início. Ilustrações originais em Canvas e SVG, sem arquivos ou serviços da Vostu.

## Desenvolvimento

Python 3 e um navegador moderno bastam. Não há dependências externas em tempo de execução, credenciais ou compilação:

```sh
cd /workspace/Projeto-minifazenda
python3 -m http.server 8000 --bind 0.0.0.0
```

Confira a sintaxe com `node --check game.js`.

## Início e progressão

A partida começa no nível 1, com 50 moedas, nove espaços de grama para preparar, milho liberado e nenhum prédio ou animal comprado. Selecione a enxada, aplique terra sem custo, escolha uma semente, plante, regue, espere crescer e colha para vender. A terra preparada permanece após a colheita. Objetivos sequenciais dão recompensas que só podem ser recebidas uma vez. Cada 100 XP corresponde a um nível.

| Cultura | Nível | Custo | Crescimento | Venda | XP |
| --- | --- | --- | --- | --- | --- |
| Milho | 1 | 5 | 20 s | 15 | 10 |
| Cenoura | 2 | 8 | 35 s | 24 | 15 |
| Morango | 3 | 12 | 50 s | 38 | 20 |

As sementes são cobradas no plantio. Plantas crescem pelo tempo transcorrido, inclusive enquanto a página está fechada. Não murcham.

O mapa de fundo e o terreno são camadas separadas. O terreno é um quadrado em perspectiva isométrica, com a ponta da frente voltada para o jogador. Sua borda normal é apenas verde, sem setas ou medidas. O canto de trás é fixo; cada expansão adiciona área somente pelas duas bordas da frente, preservando o quadrado e todos os canteiros existentes.

Para expandir, abra **Loja → Expansão**. Apenas nesse modo aparecem a metragem atual e futura, a prévia da área e duas setas nas bordas da frente. Ambas abrem a mesma compra de expansão quadrada. **Voltar à fazenda**, Escape ou selecionar uma ferramenta encerra a visualização. A metragem considera os canteiros e a faixa de grama do terreno: começa em 9 × 9 m e pode chegar a 18 × 18 m.

A loja permite comprar melhorias; o nível libera a opção e as moedas pagam a compra:

- Terreno: 9 → 25 → 49 → 81 → 144 canteiros. Expansões custam 100, 250, 600 e 1.200 moedas e exigem níveis 2, 3, 5 e 7.
- Laranjeira: nível 2, 80 moedas. Produz uma colheita de frutas a cada 60 s; recolher rende 15 moedas e 3 XP. Não acumula múltiplas colheitas sem coleta.
- Galinheiro: nível 3, 240 moedas. Alimentar custa 5; após 45 s, recolher ovos rende 30 moedas e 5 XP. Cada novo ciclo exige alimentação.
- Casa: nível 4, 400 moedas. Aumenta em 20% as moedas recebidas por colheitas nos canteiros.
- Trator: nível 6, 900 moedas. Rega de uma vez as plantas secas, cobrando 1 moeda por canteiro; regar manualmente continua gratuito.

Compras de melhorias preservam pelo menos 5 moedas para que o jogador possa continuar plantando. Os prédios só aparecem após a compra e podem ser clicados para usar suas funções.

## Controles e salvamento

Arraste o mapa para mover a câmera, use a roda ou +/− para aproximar e o botão de casa para centralizar. As teclas 1 a 5 selecionam visualizar, plantar, regar, colher e aplicar terra. Ajuda e Objetivos ficam à esquerda.

O painel verde no canto inferior direito mantém a disposição da referência: Loja ocupa duas linhas à esquerda; visualizar, enxada e máquinas ficam em cima; conquistas, presentes e armazém ficam embaixo.

- **Loja:** sementes, construções e entrada para o modo de expansão.
- **Visualizar:** modo inicial; inspeciona a fazenda e abre objetos sem plantar ou modificar o solo.
- **Enxada:** aplica terra gratuitamente nos espaços de grama liberados. Não prepara áreas bloqueadas.
- **Conquistas:** medalhas ligadas às colheitas, plantios, expansões e bens conquistados. Os objetivos com recompensas continuam separados.
- **Máquinas:** consulta, compra e uso do trator, respeitando o nível necessário.
- **Presentes:** caixa vazia, com contador zero. O envio real entre amigos ainda não existe; a interface informa essa limitação e não inventa presentes recebidos.
- **Armazém:** guarda os objetos retirados da fazenda. Clique em um objeto e em “Guardar no armazém”; depois use “Recolocar” para devolvê-lo à posição original sem pagar novamente. Objetos guardados não aparecem na fazenda, não produzem e não dão bônus. A produção retoma o tempo restante quando o objeto volta.

O progresso é salvo automaticamente neste navegador, sob `minifazenda-progress-v3`. Esta campanha começa do zero, separada do antigo protótipo com cenário pronto. O salvamento anterior (`minifazenda-save-v1`) permanece intacto. A migração do terreno centralizado para a expansão frontal conserva moedas, XP, compras, culturas e seus tempos; uma cópia anterior fica em `minifazenda-progress-v3-before-front-square`. A atualização da enxada preserva a terra preparada nos salvamentos anteriores e mantém uma cópia em `minifazenda-progress-v3-before-manual-soil`. Ainda não há contas, sincronização entre aparelhos ou visitas a amigos.

## Teste funcional

O teste automatizado usa Chromium e Playwright apenas no desenvolvimento. Com o servidor em execução, instale o executor fora do checkout e execute:

```sh
npm install --prefix /tmp/minifazenda-check --cache /tmp/npm-cache playwright
PLAYWRIGHT_MODULE=/tmp/minifazenda-check/node_modules/playwright node tests/progression.cjs
PLAYWRIGHT_MODULE=/tmp/minifazenda-check/node_modules/playwright node tests/map.cjs
PLAYWRIGHT_MODULE=/tmp/minifazenda-check/node_modules/playwright node tests/panel.cjs
```

`BASE_URL` pode indicar outro servidor local e `CHROMIUM_PATH` pode indicar outro executável. O padrão é `http://127.0.0.1:8000` e `/usr/bin/chromium`.

O teste percorre a evolução inicial com colheitas reais e relógio simulado, verifica bloqueios por nível, expansões, recompensas únicas, produção das construções, bônus da casa, trator, reserva para sementes, persistência e interface móvel. Os cenários de níveis avançados usam um estado preparado exclusivamente no navegador de teste. O teste de mapa verifica a geometria quadrada, a âncora de trás, as expansões frontais, a visibilidade das medidas somente no modo de expansão, os dois controles, cancelamento e migração dos salvamentos. O teste de painel verifica os sete botões, a enxada, o modo de visualizar, as conquistas, as máquinas, a caixa de presentes vazia, o ciclo de guardar/recolocar, a pausa de produção e o posicionamento em telas de 390 e 320 pixels.

## Publicação

GitHub Pages publica a branch `main`, pasta raiz, em:

https://lucasttb.github.io/Projeto-minifazenda/

Atualizações mantêm o mesmo endereço. A publicação pode levar alguns minutos.
