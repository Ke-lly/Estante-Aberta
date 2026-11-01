
// =====================================
// CONFIGURAÇÕES DA API RESTHEART
// =====================================

const API_URL = "http://localhost:8080/books.";

const usuario = "admin";
const senha = prompt("Digite a senha do RESTHeart:");

const credenciais = btoa(`${usuario}:${senha}`);


// =====================================
// ELEMENTOS DO HTML
// =====================================

const listaLivros = document.getElementById("listaLivros");
const quantidadeLivros = document.getElementById("quantidadeLivros");
const campoBusca = document.getElementById("campoBusca");


// =====================================
// LISTA DE LIVROS
// =====================================

let livros = [];


// =====================================
// FUNÇÃO PARA CRIAR UM CARD
// =====================================

function criarCardLivro(livro) {

    const card = document.createElement("article");
    card.className = "livro-card";


    // CAPA DO LIVRO

    if (livro.capaId) {

        const imagem = document.createElement("img");

        imagem.src =
            `https://covers.openlibrary.org/b/id/${encodeURIComponent(livro.capaId)}-M.jpg`;

        imagem.alt =
            `Capa do livro ${livro.titulo || "Sem título"}`;

        imagem.onerror = function () {

            const placeholder = document.createElement("div");

            placeholder.className = "capa-indisponivel";
            placeholder.textContent = "📚";

            this.replaceWith(placeholder);

        };

        card.appendChild(imagem);

    } else {

        const placeholder = document.createElement("div");

        placeholder.className = "capa-indisponivel";
        placeholder.textContent = "📚";

        card.appendChild(placeholder);

    }


    // TÍTULO

    const titulo = document.createElement("h3");

    titulo.textContent =
        livro.titulo || "Título não informado";

    card.appendChild(titulo);


    // AUTORES

    const autores = document.createElement("p");

    autores.textContent = Array.isArray(livro.autores)
        ? livro.autores.join(", ")
        : livro.autores || "Autor não informado";

    card.appendChild(autores);


    // ANO DE PUBLICAÇÃO

    const ano = document.createElement("p");

    ano.textContent = livro.anoPublicacao
        ? `Publicado em ${livro.anoPublicacao}`
        : "Ano não informado";

    card.appendChild(ano);


    return card;

}


// =====================================
// FUNÇÃO PARA EXIBIR OS LIVROS
// =====================================

function exibirLivros(lista) {

    listaLivros.innerHTML = "";

    if (lista.length === 0) {

        listaLivros.innerHTML = `
            <p>Nenhum livro encontrado.</p>
        `;

        return;

    }

    lista.forEach(function (livro) {

        const card = criarCardLivro(livro);

        listaLivros.appendChild(card);

    });

}


// =====================================
// FUNÇÃO PARA BUSCAR OS LIVROS
// =====================================

async function carregarLivros() {

    try {

        listaLivros.innerHTML =
            "<p>Carregando livros...</p>";

        const resposta = await fetch(API_URL, {

            method: "GET",

            headers: {
                "Authorization": `Basic ${credenciais}`,
                "Content-Type": "application/json"
            }

        });

        if (!resposta.ok) {

            throw new Error(`Erro HTTP: ${resposta.status}`);

        }

        const dados = await resposta.json();

        console.log("Resposta da API:", dados);


        // ARMAZENA OS LIVROS RECEBIDOS

        livros = dados._embedded?.["rh:doc"] || dados;

        if (!Array.isArray(livros)) {

            throw new Error("Formato de resposta da API inválido.");

        }


        // ATUALIZA A QUANTIDADE

        quantidadeLivros.textContent =
            `${livros.length} livros disponíveis`;


        // EXIBE OS CARDS

        exibirLivros(livros);


    } catch (erro) {

        console.error("Erro ao carregar livros:", erro);

        quantidadeLivros.textContent =
            "Erro na conexão";

        listaLivros.innerHTML = `
            <p class="mensagem-erro">
                Não foi possível carregar os livros.
                Verifique a conexão com o RESTHeart.
            </p>
        `;

    }

}


// =====================================
// CAMPO DE BUSCA
// =====================================

campoBusca.addEventListener("input", function () {

    const pesquisa =
        campoBusca.value.toLowerCase().trim();


    const livrosFiltrados = livros.filter(function (livro) {

        const titulo =
            (livro.titulo || "").toLowerCase();

        const autores = Array.isArray(livro.autores)
            ? livro.autores.join(" ").toLowerCase()
            : (livro.autores || "").toLowerCase();


        return titulo.includes(pesquisa) ||
               autores.includes(pesquisa);

    });


    quantidadeLivros.textContent =
        `${livrosFiltrados.length} livros encontrados`;

    exibirLivros(livrosFiltrados);

});


// =====================================
// INICIAR A APLICAÇÃO
// =====================================

carregarLivros();
