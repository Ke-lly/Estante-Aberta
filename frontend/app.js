
const API_URL = "http://localhost:8080/books.";
const OPEN_LIBRARY_URL = "http://localhost:8080/books.";
const CABECALHOS = {
    "Content-Type": "application/json",
    "Authorization": "Basic " + btoa("admin:secret")
};

const listaLivros = document.getElementById("listaLivros");
const formulario = document.getElementById("formLivro");
const modalLivro = document.getElementById("modalLivro");

let livros = [];
let graficoDecadas = null;
let graficoCategorias = null;
let livroEditado = null;

function mostrarMensagem(texto, tipo) {
    const aviso = document.getElementById("mensagemSistema");
    aviso.textContent = texto;
    aviso.className = "mensagem " + tipo;
    aviso.hidden = false;
}

function pegarId(livro) {
    if (livro._id && livro._id.$oid) return livro._id.$oid;
    if (livro._id && livro._id.oid) return livro._id.oid;
    return String(livro._id || "");
}

function listaParaTexto(valor) {
    if (Array.isArray(valor)) return valor.join(", ");
    return valor || "";
}

function textoParaLista(valor) {
    const partes = valor.split(",");
    const lista = [];
    for (let i = 0; i < partes.length; i++) {
        if (partes[i].trim() !== "") lista.push(partes[i].trim());
    }
    return lista;
}

function pegarCategoria(livro) {
    if (Array.isArray(livro.assuntos) && livro.assuntos.length > 0) return livro.assuntos[0];
    if (typeof livro.assuntos === "string" && livro.assuntos !== "") return livro.assuntos;
    return "Sem categoria";
}

function escaparHTML(texto) {
    return String(texto || "").replace(/[&<>"']/g, function (letra) {
        const caracteres = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
        return caracteres[letra];
    });
}

async function fazerRequisicao(url, metodo, documento) {
    const opcoes = { method: metodo, headers: CABECALHOS };
    if (documento !== null && documento !== undefined) {
        opcoes.body = JSON.stringify(documento);
    }

    let resposta;
    try {
        resposta = await fetch(url, opcoes);
    } catch (erro) {
        throw new Error("Não foi possível conectar ao RESTHeart. Confira o Docker.");
    }

    const texto = await resposta.text();
    let dados = null;
    if (texto !== "") {
        try {
            dados = JSON.parse(texto);
        } catch (erro) {
            dados = texto;
        }
    }

    if (!resposta.ok) {
        const erro = new Error("HTTP " + resposta.status + ": " + texto);
        erro.status = resposta.status;
        throw erro;
    }

    return { status: resposta.status, dados: dados };
}

async function criarColecao() {
    try {
        await fazerRequisicao(API_URL, "GET", null);
    } catch (erro) {
        if (erro.status === 404) {
            await fazerRequisicao(API_URL, "PUT", null);
        } else {
            throw erro;
        }
    }
}

async function buscarLivros() {
    const resultado = await fazerRequisicao(API_URL + "?pagesize=100", "GET", null);
    let documentos = resultado.dados;

    if (!Array.isArray(documentos) && documentos && documentos._embedded) {
        documentos = documentos._embedded["rh:doc"] || documentos._embedded.documents;
    }
    if (!Array.isArray(documentos)) throw new Error("O banco não retornou uma lista de livros.");

    for (let i = 0; i < documentos.length; i++) {
        documentos[i].id = pegarId(documentos[i]);
    }
    return documentos;
}

async function buscarLivroPorId(id) {
    const resultado = await fazerRequisicao(API_URL + "/" + id, "GET", null);
    const livro = resultado.dados;
    livro.id = pegarId(livro);
    return livro;
}

async function carregarLivros(aviso) {
    listaLivros.innerHTML = "<p>Carregando livros...</p>";
    try {
        await criarColecao();
        livros = await buscarLivros();
        atualizarCategorias();
        aplicarFiltros();
        atualizarPainel();
        if (aviso) mostrarMensagem(aviso, "sucesso");
    } catch (erro) {
        livros = [];
        listaLivros.innerHTML = "<p>Não foi possível carregar a biblioteca.</p>";
        document.getElementById("quantidadeLivros").textContent = "Erro na conexão";
        mostrarMensagem(erro.message, "erro");
        atualizarPainel();
    }
}

function prepararLivro(item) {
    const dataAtual = new Date().toISOString();
    return {
        titulo: item.title || "Título não informado",
        autores: item.author_name || [],
        anoPublicacao: item.first_publish_year || null,
        numeroEdicoes: item.edition_count || 0,
        capaId: item.cover_i ? String(item.cover_i) : "",
        assuntos: item.subject ? item.subject.slice(0, 8) : [],
        favorito: false,
        nota: 0,
        comentario: "",
        importadoEm: dataAtual,
        atualizadoEm: dataAtual,
        origem: {
            api: "Open Library",
            obraKey: item.key || "",
            url: "https://openlibrary.org" + (item.key || "")
        }
    };
}

async function importarLivros() {
    const botao = document.getElementById("btnImportar");
    botao.disabled = true;
    botao.textContent = "Importando...";
    mostrarMensagem("Buscando livros na Open Library...", "info");

    try {
        const resposta = await fetch(OPEN_LIBRARY_URL);
        if (!resposta.ok) throw new Error("Open Library respondeu com HTTP " + resposta.status);
        const dados = await resposta.json();
        const novosLivros = [];

        for (let i = 0; i < dados.docs.length; i++) {
            const item = dados.docs[i];
            let existe = false;

            for (let j = 0; j < livros.length; j++) {
                if (livros[j].origem && livros[j].origem.obraKey === item.key) existe = true;
            }
            for (let j = 0; j < novosLivros.length; j++) {
                if (novosLivros[j].key === item.key) existe = true;
            }

            if (item.key && item.title && !existe) novosLivros.push(item);
        }

        const quantidade = Math.min(novosLivros.length, 30);
        if (quantidade === 0) {
            mostrarMensagem("Os livros dessa consulta já estão cadastrados.", "info");
        } else {
            for (let i = 0; i < quantidade; i++) {
                const livro = prepararLivro(novosLivros[i]);
                await fazerRequisicao(API_URL, "POST", livro);
                botao.textContent = "Importando " + (i + 1) + "/" + quantidade;
            }
            await carregarLivros(quantidade + " livros importados com sucesso!");
        }
    } catch (erro) {
        mostrarMensagem("Erro na importação: " + erro.message, "erro");
        await carregarLivros();
    } finally {
        botao.disabled = false;
        botao.textContent = "⬇ Importar 30 livros";
    }
}

function limparFormulario() {
    formulario.reset();
    document.getElementById("livroId").value = "";
    document.getElementById("edicoesLivro").value = 0;
    document.getElementById("notaLivro").value = 0;
    document.getElementById("tituloModal").textContent = "Adicionar livro";
    document.getElementById("salvarLivro").textContent = "Salvar livro";
    livroEditado = null;
}

function abrirNovoLivro() {
    limparFormulario();
    modalLivro.showModal();
}

async function abrirEdicao(id) {
    try {
        livroEditado = await buscarLivroPorId(id);
        document.getElementById("livroId").value = id;
        document.getElementById("tituloLivro").value = livroEditado.titulo || "";
        document.getElementById("autoresLivro").value = listaParaTexto(livroEditado.autores);
        document.getElementById("anoLivro").value = livroEditado.anoPublicacao || "";
        document.getElementById("edicoesLivro").value = livroEditado.numeroEdicoes || 0;
        document.getElementById("assuntosLivro").value = listaParaTexto(livroEditado.assuntos);
        document.getElementById("capaLivro").value = livroEditado.capaId || "";
        document.getElementById("notaLivro").value = livroEditado.nota || 0;
        document.getElementById("favoritoLivro").checked = Boolean(livroEditado.favorito);
        document.getElementById("comentarioLivro").value = livroEditado.comentario || "";
        document.getElementById("tituloModal").textContent = "Editar livro";
        document.getElementById("salvarLivro").textContent = "Salvar alterações";
        modalLivro.showModal();
    } catch (erro) {
        mostrarMensagem("Erro ao buscar o livro: " + erro.message, "erro");
    }
}

function montarDocumento() {
    const dataAtual = new Date().toISOString();
    const ano = document.getElementById("anoLivro").value;
    return {
        titulo: document.getElementById("tituloLivro").value.trim(),
        autores: textoParaLista(document.getElementById("autoresLivro").value),
        anoPublicacao: ano ? Number(ano) : null,
        numeroEdicoes: Number(document.getElementById("edicoesLivro").value),
        assuntos: textoParaLista(document.getElementById("assuntosLivro").value),
        capaId: document.getElementById("capaLivro").value.trim(),
        favorito: document.getElementById("favoritoLivro").checked,
        nota: Number(document.getElementById("notaLivro").value || 0),
        comentario: document.getElementById("comentarioLivro").value.trim(),
        importadoEm: livroEditado ? livroEditado.importadoEm : dataAtual,
        atualizadoEm: dataAtual,
        origem: livroEditado ? livroEditado.origem : {
            api: "Cadastro manual", obraKey: "manual-" + Date.now(), url: ""
        }
    };
}

async function salvarLivro(evento) {
    evento.preventDefault();
    if (!formulario.reportValidity()) return;

    const id = document.getElementById("livroId").value;
    const botao = document.getElementById("salvarLivro");
    botao.disabled = true;

    try {
        const documento = montarDocumento();
        if (id) {
            // PUT substitui o documento inteiro.
            const resultado = await fazerRequisicao(API_URL + "/" + id, "PUT", documento);
            modalLivro.close();
            limparFormulario();
            await carregarLivros("Livro editado! HTTP " + resultado.status);
        } else {
            const resultado = await fazerRequisicao(API_URL, "POST", documento);
            modalLivro.close();
            limparFormulario();
            await carregarLivros("Livro cadastrado! HTTP " + resultado.status);
        }
    } catch (erro) {
        mostrarMensagem("Erro ao salvar o livro: " + erro.message, "erro");
    } finally {
        botao.disabled = false;
    }
}

async function alternarFavorito(id, favoritoAtual) {
    try {
        const dados = { favorito: !favoritoAtual, atualizadoEm: new Date().toISOString() };
        const resultado = await fazerRequisicao(API_URL + "/" + id, "PATCH", dados);
        await carregarLivros("Favorito atualizado! HTTP " + resultado.status);
    } catch (erro) {
        mostrarMensagem("Erro ao atualizar favorito: " + erro.message, "erro");
    }
}

async function excluirLivro(id, titulo) {
    if (!confirm("Deseja excluir o livro '" + titulo + "'?")) return;

    try {
        const resultado = await fazerRequisicao(API_URL + "/" + id, "DELETE", null);
        await carregarLivros("Livro excluído! HTTP " + (resultado.status || 204));
    } catch (erro) {
        mostrarMensagem("Erro ao excluir o livro: " + erro.message, "erro");
    }
}

function criarCard(livro) {
    const card = document.createElement("article");
    card.className = "livro-card";

    let capa = "<div class='capa-indisponivel'>📚</div>";
    if (livro.capaId) {
        capa = "<img class='livro-capa' src='https://covers.openlibrary.org/b/id/" + encodeURIComponent(livro.capaId) + "-M.jpg' alt='Capa do livro'>";
    }

    card.innerHTML = capa +
        "<h3>" + escaparHTML(livro.titulo || "Título não informado") + "</h3>" +
        "<p>" + escaparHTML(listaParaTexto(livro.autores) || "Autor não informado") + "</p>" +
        "<p>" + (livro.anoPublicacao || "Ano não informado") + "</p>" +
        "<span class='livro-categoria'>" + escaparHTML(pegarCategoria(livro)) + "</span>" +
        "<p>Nota: " + (livro.nota || 0) + "/5</p>" +
        "<div class='livro-acoes'>" +
        "<button type='button' class='botao-card' data-acao='favorito'>" + (livro.favorito ? "★ Favorito" : "☆ Favoritar") + "</button>" +
        "<button type='button' class='botao-card' data-acao='editar'>Editar</button>" +
        "<button type='button' class='botao-card perigo' data-acao='excluir'>Excluir</button>" +
        "</div>";

    if (livro.favorito) card.querySelector("[data-acao='favorito']").classList.add("favoritado");
    card.querySelector("[data-acao='favorito']").addEventListener("click", function () {
        alternarFavorito(livro.id, livro.favorito);
    });
    card.querySelector("[data-acao='editar']").addEventListener("click", function () {
        abrirEdicao(livro.id);
    });
    card.querySelector("[data-acao='excluir']").addEventListener("click", function () {
        excluirLivro(livro.id, livro.titulo || "este livro");
    });

    const imagem = card.querySelector("img");
    if (imagem) {
        imagem.onerror = function () {
            const capaVazia = document.createElement("div");
            capaVazia.className = "capa-indisponivel";
            capaVazia.textContent = "📚";
            imagem.replaceWith(capaVazia);
        };
    }
    return card;
}

function mostrarLivros(resultado) {
    listaLivros.innerHTML = "";
    if (resultado.length === 0) {
        listaLivros.innerHTML = "<p>Nenhum livro encontrado.</p>";
        return;
    }
    for (let i = 0; i < resultado.length; i++) {
        listaLivros.appendChild(criarCard(resultado[i]));
    }
}

function atualizarCategorias() {
    const filtro = document.getElementById("filtroCategoria");
    const selecionada = filtro.value;
    const categorias = [];

    for (let i = 0; i < livros.length; i++) {
        const nome = pegarCategoria(livros[i]);
        if (!categorias.includes(nome)) categorias.push(nome);
    }
    categorias.sort();
    filtro.innerHTML = "<option value=''>Todas as categorias</option>";

    for (let i = 0; i < categorias.length; i++) {
        const opcao = document.createElement("option");
        opcao.value = categorias[i];
        opcao.textContent = categorias[i];
        filtro.appendChild(opcao);
    }
    if (categorias.includes(selecionada)) filtro.value = selecionada;
}

function aplicarFiltros() {
    const busca = document.getElementById("campoBusca").value.toLowerCase();
    const categoria = document.getElementById("filtroCategoria").value;
    const favoritos = document.getElementById("filtroFavoritos").value;
    const resultado = [];

    for (let i = 0; i < livros.length; i++) {
        const livro = livros[i];
        const dados = (livro.titulo || "") + " " + listaParaTexto(livro.autores) + " " + listaParaTexto(livro.assuntos);
        let combina = dados.toLowerCase().includes(busca);

        if (categoria !== "" && pegarCategoria(livro) !== categoria) combina = false;
        if (favoritos === "favoritos" && !livro.favorito) combina = false;
        if (favoritos === "nao-favoritos" && livro.favorito) combina = false;
        if (combina) resultado.push(livro);
    }

    mostrarLivros(resultado);
    document.getElementById("quantidadeLivros").textContent = resultado.length + " de " + livros.length + " livros";
}

function contarCategorias() {
    const contagem = {};
    for (let i = 0; i < livros.length; i++) {
        const nome = pegarCategoria(livros[i]);
        if (contagem[nome]) contagem[nome]++;
        else contagem[nome] = 1;
    }

    const resultado = [];
    for (let nome in contagem) {
        resultado.push({ nome: nome, total: contagem[nome] });
    }
    resultado.sort(function (a, b) { return b.total - a.total; });
    return resultado;
}

function contarDecadas() {
    const contagem = {};
    for (let i = 0; i < livros.length; i++) {
        const ano = Number(livros[i].anoPublicacao);
        if (ano > 0) {
            const decada = Math.floor(ano / 10) * 10;
            if (contagem[decada]) contagem[decada]++;
            else contagem[decada] = 1;
        }
    }

    const resultado = [];
    for (let decada in contagem) {
        resultado.push({ nome: decada + "s", total: contagem[decada] });
    }
    resultado.sort(function (a, b) { return parseInt(a.nome) - parseInt(b.nome); });
    return resultado;
}

function atualizarGraficos() {
    if (typeof Chart === "undefined") return;

    const decadas = contarDecadas();
    const categorias = contarCategorias();
    const nomes = [];
    const quantidades = [];

    for (let i = 0; i < categorias.length && i < 7; i++) {
        nomes.push(categorias[i].nome);
        quantidades.push(categorias[i].total);
    }
    if (categorias.length > 7) {
        let outras = 0;
        for (let i = 7; i < categorias.length; i++) outras += categorias[i].total;
        nomes.push("Outras");
        quantidades.push(outras);
    }

    if (graficoDecadas) graficoDecadas.destroy();
    if (graficoCategorias) graficoCategorias.destroy();

    graficoDecadas = new Chart(document.getElementById("graficoDecadas"), {
        type: "bar",
        data: {
            labels: decadas.map(function (item) { return item.nome; }),
            datasets: [{ label: "Livros", data: decadas.map(function (item) { return item.total; }), backgroundColor: "#6f9b7d" }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    graficoCategorias = new Chart(document.getElementById("graficoCategorias"), {
        type: "doughnut",
        data: {
            labels: nomes,
            datasets: [{ data: quantidades, backgroundColor: ["#355b48", "#6f9b7d", "#a8c9b0", "#d1a86f", "#91a9a0", "#718b9a", "#c6b6a0", "#a8a0b5"] }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function atualizarRanking() {
    const contagem = {};
    for (let i = 0; i < livros.length; i++) {
        let autores = livros[i].autores || [];
        if (!Array.isArray(autores)) autores = [autores];
        for (let j = 0; j < autores.length; j++) {
            const nome = autores[j];
            if (nome) {
                if (contagem[nome]) contagem[nome]++;
                else contagem[nome] = 1;
            }
        }
    }

    const ranking = [];
    for (let nome in contagem) ranking.push({ nome: nome, total: contagem[nome] });
    ranking.sort(function (a, b) { return b.total - a.total; });

    const lista = document.getElementById("rankingAutores");
    lista.innerHTML = "";
    if (ranking.length === 0) lista.innerHTML = "<li>Nenhum autor cadastrado.</li>";
    for (let i = 0; i < ranking.length && i < 5; i++) {
        const item = document.createElement("li");
        item.textContent = ranking[i].nome + " - " + ranking[i].total + " livro(s)";
        lista.appendChild(item);
    }
}

function atualizarAgrupamento() {
    const categorias = contarCategorias();
    const lista = document.getElementById("agrupamentoCategorias");
    lista.innerHTML = "";
    if (categorias.length === 0) lista.innerHTML = "<li>Nenhuma categoria cadastrada.</li>";

    for (let i = 0; i < categorias.length && i < 12; i++) {
        const item = document.createElement("li");
        item.innerHTML = "<span></span><strong></strong>";
        item.querySelector("span").textContent = categorias[i].nome;
        item.querySelector("strong").textContent = categorias[i].total;
        lista.appendChild(item);
    }
}

function atualizarConclusao() {
    const decadas = contarDecadas();
    const categorias = contarCategorias();
    let texto = "A estante possui " + livros.length + " livros.";

    if (decadas.length > 0) {
        let maiorDecada = decadas[0];
        for (let i = 1; i < decadas.length; i++) {
            if (decadas[i].total > maiorDecada.total) maiorDecada = decadas[i];
        }
        texto += " A década com mais publicações é " + maiorDecada.nome + ", com " + maiorDecada.total + " livros.";
    }
    if (categorias.length > 0 && categorias[0].nome !== "Sem categoria") {
        texto += " A categoria mais frequente é " + categorias[0].nome + ", com " + categorias[0].total + " livros.";
    }
    document.getElementById("conclusaoDados").textContent = texto;
}

function atualizarPainel() {
    const anos = [];
    const notas = [];
    let favoritos = 0;
    let capas = 0;
    let somaAnos = 0;
    let somaNotas = 0;

    for (let i = 0; i < livros.length; i++) {
        const ano = Number(livros[i].anoPublicacao);
        const nota = Number(livros[i].nota);
        if (ano > 0) anos.push(ano);
        if (nota > 0) notas.push(nota);
        if (livros[i].favorito) favoritos++;
        if (livros[i].capaId) capas++;
    }
    for (let i = 0; i < anos.length; i++) somaAnos += anos[i];
    for (let i = 0; i < notas.length; i++) somaNotas += notas[i];

    document.getElementById("indicadorTotal").textContent = livros.length;
    document.getElementById("indicadorFavoritos").textContent = favoritos;
    document.getElementById("indicadorAnoMedio").textContent = anos.length ? (somaAnos / anos.length).toFixed(0) : "—";
    document.getElementById("indicadorAnoMaximo").textContent = anos.length ? Math.max.apply(null, anos) : "—";
    document.getElementById("indicadorNotaMedia").textContent = notas.length ? (somaNotas / notas.length).toFixed(1) + "/5" : "—";
    document.getElementById("indicadorCapas").textContent = livros.length ? (capas / livros.length * 100).toFixed(0) + "%" : "0%";

    atualizarGraficos();
    atualizarRanking();
    atualizarAgrupamento();
    atualizarConclusao();
}

document.getElementById("btnImportar").addEventListener("click", importarLivros);
document.getElementById("btnNovoLivro").addEventListener("click", abrirNovoLivro);
document.getElementById("btnAtualizar").addEventListener("click", function () {
    carregarLivros("Biblioteca atualizada.");
});
document.getElementById("fecharModal").addEventListener("click", function () { modalLivro.close(); });
document.getElementById("cancelarFormulario").addEventListener("click", function () { modalLivro.close(); });
formulario.addEventListener("submit", salvarLivro);
document.getElementById("campoBusca").addEventListener("input", aplicarFiltros);
document.getElementById("filtroCategoria").addEventListener("change", aplicarFiltros);
document.getElementById("filtroFavoritos").addEventListener("change", aplicarFiltros);

carregarLivros();
