# Estante Aberta — Entrega da Semana 1

**Prazo:** 25/10/2026  
**Disciplina:** Engenharia de Software — Banco de Dados  
**Tema escolhido:** Livros  
**API de origem:** Open Library Search API — `https://openlibrary.org/search.json?subject=programming&limit=30`

## Integrantes do grupo

- Integrantes: **[preencher com os nomes reais]**
- Tema e ordem de preferência: **Livros — Open Library** *(confirmar a distribuição do tema com o professor)*
- Papéis principais: **Dados/Docker:** [nome] · **API/HTTP:** [nome] · **Interface:** [nome]

## 1. Subir o banco no Docker

Abra o PowerShell nesta pasta e execute:

```powershell
docker compose up -d
docker compose ps
```

Os serviços `mongodb` e `restheart` devem aparecer em execução. Endereços locais:

- RESTHeart: `http://localhost:8080`
- MongoDB: `localhost:27017`

O volume nomeado `dados-mongo` mantém os dados ao reiniciar os containers.

## 2. Modelo do documento JSON

O arquivo `modelo/livro-exemplo.json` representa a estrutura prevista para um livro. Ele contém campos numéricos (`anoPublicacao`, `paginasMedias` e `nota`), datas (`criadoEm` e `atualizadoEm`), listas embutidas (`autores`, `assuntos`, `isbn`) e um objeto embutido (`origem`). Esses dados relacionados foram embutidos porque são exibidos junto ao registro do livro.

O registro é **ilustrativo**, usado somente para testar a estrutura; não afirma ser um livro importado da Open Library.

## 3. Primeiras requisições no Postman

Importe `postman/Estante-Aberta-Semana-1.postman_collection.json` no Postman. A autenticação Basic (`admin` / `secret`) e o endereço `http://localhost:8080` já estão configurados para o ambiente local.

Execute nesta ordem:

1. **01 — Criar coleção books (PUT)** — primeira criação: `201 Created`.
2. **02 — Listar livros (GET)** — `200 OK`.
3. **03 — Inserir livro de teste (POST)** — `201 Created`.

Após executar, guarde capturas de tela das respostas do Postman como evidência dos testes. As credenciais são apenas para o ambiente local da atividade; não as reutilize em produção.
