require('dotenv').config();

const express = require('express');
const hbs = require('hbs');
const SpotifyWebApi = require('spotify-web-api-node');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));

// (opcional) registra parciales si los usas en /views/partials
// hbs.registerPartials(__dirname + '/views/partials');

// Instancia API Spotify
const spotifyApi = new SpotifyWebApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET
});

// Función para obtener/renovar token
async function ensureAccessToken() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body.access_token);
    // devuelve segundos hasta expirar
    return data.body.expires_in;
  } catch (error) {
    console.error('Error al obtener token de acceso', error);
    throw error;
  }
}

// Al iniciar servidor, obtenemos token y programamos renovación periódica
(async () => {
  try {
    const expiresIn = await ensureAccessToken(); // ~3600 s
    // Renovar 10 min antes de caducar
    const refreshMs = Math.max(1, (expiresIn - 600) * 1000);
    setInterval(() => ensureAccessToken().catch(() => {}), refreshMs);
  } catch {
    // Si falla el token al arrancar, el primer request lo volverá a intentar
  }
})();

// Middleware: si por lo que sea no hay token, lo pide antes de atender la ruta
async function withToken(req, res, next) {
  try {
    // no hay método público para “comprobar” el token, pero si falla la llamada, capturamos abajo
    if (!spotifyApi.getAccessToken()) await ensureAccessToken();
  } catch (e) {
    return res.status(500).render('error', { message: 'No se pudo autenticar con Spotify.' });
  }
  next();
}

// Home
app.get('/', (req, res) => res.render('index'));

// Buscar artistas
app.get('/artist-search', withToken, async (req, res) => {
  const artist = (req.query.artist || '').trim();
  if (!artist) return res.render('artist-search-results', { artists: [], query: '' });

  try {
    const data = await spotifyApi.searchArtists(artist);
    res.render('artist-search-results', {
      artists: data.body.artists.items,
      query: artist
    });
  } catch (err) {
    console.error('Error buscando artistas', err);
    res.status(500).render('error', { message: 'Error buscando artistas.' });
  }
});

// Álbumes por artista
app.get('/albums/:artistId', withToken, async (req, res) => {
  try {
    const data = await spotifyApi.getArtistAlbums(req.params.artistId);
    res.render('albums', { albums: data.body.items });
  } catch (err) {
    console.error('Error obteniendo álbumes', err);
    res.status(500).render('error', { message: 'Error obteniendo álbumes.' });
  }
});

// Tracks por álbum
app.get('/tracks/:albumId', withToken, async (req, res) => {
  try {
    const data = await spotifyApi.getAlbumTracks(req.params.albumId);
    res.render('tracks', { tracks: data.body.items });
  } catch (err) {
    console.error('Error obteniendo canciones', err);
    res.status(500).render('error', { message: 'Error obteniendo canciones.' });
  }
});

app.listen(PORT, () => {
  console.log(`My Spotify project running on port ${PORT} 🎧 🥁 🎸 🔊`);
});
