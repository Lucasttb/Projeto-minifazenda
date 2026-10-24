# Minha Minifazenda

Protótipo original de uma fazenda isométrica, inspirado nas referências visuais fornecidas. Os desenhos são provisórios e não utilizam arquivos do jogo da Vostu.

## Executar

Requer Python 3, sem dependências externas:

```sh
cd /workspace/Projeto-minifazenda
python3 -m http.server 8000 --bind 0.0.0.0
```

Abra o endereço do servidor em um navegador. Escolha Plantar, clique em um canteiro, escolha Regar e clique nele novamente. Após 20 segundos, escolha Colher para ganhar moedas e experiência. O progresso é salvo no armazenamento local do navegador. O botão Salvar informa se o armazenamento está disponível.

Ainda não há contas, servidor de jogo, visitas a amigos ou artes finais. Para reiniciar, remova a chave `minifazenda-save-v1` do armazenamento local do site.
