const fs = require('fs');
const path = require('path');
const cliProgress = require('cli-progress');

// animefire.plus

// https://lightspeedst.net/s4/mp4//fhd/1.mp4?type=video/mp4&title=[AnimeFire.plus]%20Youkoso%20Jitsuryoku%20Shijou%20Shugi%20no%20Kyoushitsu%20e%20(Dublado)%20-%20Epis%C3%B3dio%201%20(F-HD)

const animeName = 'yofukashi-no-uta';
const baseURL = `https://lightspeedst.net/s4/mp4/${animeName}/fhd/`;
const episodeCount = 13;  // Número total de episódios

// Extrai o nome da pasta dos episódios da URL
const folderPath = path.join(__dirname, animeName);

// Cria a pasta se não existir
if (!fs.existsSync(folderPath)) {
  fs.mkdirSync(folderPath);
}

// Configuração da barra de progresso para todos os episódios
const progressBar = new cliProgress.SingleBar({
  format: `Todos os episódios [{bar}] {percentage}% | {value}/{total} MB`,
  stopOnComplete: false,
}, cliProgress.Presets.shades_classic);

// Variável para armazenar a soma total dos bytes de todos os episódios
let totalBytes = 0;
let downloadedBytes = 0;

// Função para baixar um episódio específico
async function downloadEpisode(episodeNumber) {
  const episodeURL = `${baseURL}${episodeNumber}.mp4?type=video/mp4`;

  try {
    const fetch = await import('node-fetch');
    const response = await fetch.default(episodeURL);

    const contentLength = response.headers.get('content-length');
    if (!contentLength) {
      throw new Error('Header "Content-Length" não encontrado na resposta.');
    }

    const episodeBytes = parseInt(contentLength, 10);
    totalBytes += episodeBytes;

    progressBar.setTotal(totalBytes);

    const filePath = path.join(folderPath, `${animeName} - ${episodeNumber}.mp4`);
    const writer = fs.createWriteStream(filePath);

    return new Promise((resolve, reject) => {
      response.body.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        progressBar.update(downloadedBytes, { value: downloadedBytes });
        writer.write(chunk);
      });

      response.body.on('end', () => {
        writer.end();
        resolve(episodeBytes);
      });

      response.body.on('error', (err) => {
        console.error(`Erro ao baixar episódio ${episodeNumber}: ${err.message}`);
        reject(err);
      });
    });
  } catch (error) {
    if (error.response) {
      console.log(`Erro no episódio ${episodeNumber}, continuando com os demais.`);
      return Promise.resolve(0);
    }

    console.error(`Erro ao baixar episódio ${episodeNumber}: ${error.message}`);
    return Promise.resolve(0);
  }
}

// Função para baixar todos os episódios simultaneamente
async function downloadAllEpisodes() {
  try {
    progressBar.start(0, 0);

    const downloadPromises = [];

    for (let i = 1; i <= episodeCount; i++) {
      downloadPromises.push(downloadEpisode(i));
    }

    const episodeBytesArray = await Promise.all(downloadPromises);

    // Calcula a soma total dos bytes de todos os episódios
    const totalBytesDownloaded = episodeBytesArray.reduce((acc, current) => acc + current, 0);

    progressBar.stop();
    console.log(`Todos os episódios baixados. Total de ${totalBytesDownloaded} MB.`);

    // Tenta baixar novamente os episódios que falharam
    const retryPromises = [];

    for (let i = 1; i <= episodeCount; i++) {
      if (episodeBytesArray[i - 1] === 0) {
        retryPromises.push(downloadEpisode(i));
      }
    }

    const retryBytesArray = await Promise.all(retryPromises);
    const totalRetryBytes = retryBytesArray.reduce((acc, current) => acc + current, 0);

    console.log(`Tentando novamente. Total de ${totalRetryBytes} MB.`);
  } catch (error) {
    console.error(`Erro durante o download: ${error.message}`);
  }
}

// Chame a função para baixar todos os episódios simultaneamente
downloadAllEpisodes();
