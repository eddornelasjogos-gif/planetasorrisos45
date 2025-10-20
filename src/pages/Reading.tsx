import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Star, CheckCircle } from "lucide-react";
import { ProgressBar } from "@/components/ProgressBar";
import { useProgress } from "@/contexts/ProgressContext";
import readingImage from "@/assets/reading-books.png";
import ColorHeader from "@/components/ColorHeader";
import LevelSelector from "@/components/LevelSelector";
import mascotBackground from "@/assets/mascot-owl.png"; // Importando a imagem do mascote

// Importações de imagens para o nível FÁCIL (104-105, 205-220)
import raposaUvasImage from "@/assets/raposa-uvas.png";
import galinhaOvosOuroImage from "@/assets/galinha-ovos-ouro.png";
import principeSapoImage from "@/assets/principe-sapo.png";
import rumpelstiltskinImage from "@/assets/rumpelstiltskin.png";
import rainhaDaNeveImage from "@/assets/rainha-da-neve.png";
import gataBorralheiraImage from "@/assets/gata-borralheira.png";
import magicoDeOzImage from "@/assets/magico-de-oz.png";
import pequenoPolegarImage from "@/assets/pequeno-polegar.png";
import tresPorquinhosImage from "@/assets/tres-porquinhos.png";
import pedroLoboImage from "@/assets/pedro-e-o-lobo.png";
import simbadMarinheiroImage from "@/assets/simbad-marinheiro.png";
import aliBabaLadroesImage from "@/assets/ali-baba-ladroes.png";
import oRouxinolImage from "@/assets/o-rouxinol.png";
import barbaAzulImage from "@/assets/barba-azul.png";
import aFadaVoadoraImage from "@/assets/a-fada-voadora.png";
import oCavaloEOHomemImage from "@/assets/o-cavalo-e-o-homem.png";
import aLendaDaLuaImage from "@/assets/a-lenda-da-lua.png";
import oPescadorEOGenioImage from "@/assets/o-pescador-e-o-genio.png";

// Importações de imagens para o nível MÉDIO (101-103, 111-115, 201-204)
import cigarraFormigaImage from "@/assets/a-cigarra-e-a-formiga.png";
import lebreTartarugaImage from "@/assets/a-lebre-e-a-tartaruga.png";
import leaoRatoImage from "@/assets/o-leao-e-o-rato.png";
import patinhoFeioImage from "@/assets/o-patinho-feio.png";
import joaoPeDeFeijaoImage from "@/assets/joao-e-o-pe-de-feijao.png";
import cinderelaImage from "@/assets/cinderela.png";
import brancaDeNeveImage from "@/assets/branca-de-neve.png";
import flautistaHamelinImage from "@/assets/o-flautista-de-hamelin.png";
import chapeuzinhoVermelhoImage from "@/assets/chapeuzinho-vermelho.png";
import belaAdormecidaImage from "@/assets/a-bela-adormecida.png";
import rapunzelImage from "@/assets/rapunzel.png";
import pequenaSereiaImage from "@/assets/a-pequena-sereia.png";

// Importações de imagens para o nível DIFÍCIL (301-310)
import pinocchioImage from "@/assets/pinocchio.png";
import alicePaisMaravilhasImage from "@/assets/alice-pais-maravilhas.png";
import robinsonCrusoeImage from "@/assets/robinson-crusoe.png";
import ilhaDoTesouroImage from "@/assets/ilha-do-tesouro.png";
import medicoMonstroImage from "@/assets/medico-monstro.png";
import voltaAoMundo80DiasImage from "@/assets/volta-ao-mundo-80-dias.png";
import heidiImage from "@/assets/heidi.png";
import tomSawyerImage from "@/assets/tom-sawyer.png"; // CORRIGIDO: Importação da imagem
import corcundaNotreDameImage from "@/assets/corcunda-notre-dame.png";
import grimmHistoriasSelecionadasImage from "@/assets/grimm-historias-selecionadas.png";

// Importações de imagens para o nível MUITO DIFÍCIL (401-405)
import domQuixoteImage from "@/assets/dom-quixote.png";
import mobyDickImage from "@/assets/moby-dick.png";
import guerraEPazImage from "@/assets/guerra-e-paz.png";
import irmaosKaramazovImage from "@/assets/irmaos-karamazov.png";
import crimeECastigoImage from "@/assets/crime-e-castigo.png";


type Difficulty = "easy" | "medium" | "hard" | "very-hard";

const STORAGE_KEY = "userDifficulty";

// Mapeamento de IDs de histórias para caminhos de imagem
const STORY_IMAGE_MAP: Record<number, string> = {
    // Nível Fácil (104-105, 205-220)
    104: raposaUvasImage,
    105: galinhaOvosOuroImage,
    205: principeSapoImage,
    206: rumpelstiltskinImage,
    207: rainhaDaNeveImage,
    208: gataBorralheiraImage,
    209: magicoDeOzImage,
    210: pequenoPolegarImage,
    211: tresPorquinhosImage,
    212: pedroLoboImage,
    213: simbadMarinheiroImage,
    214: aliBabaLadroesImage,
    215: oRouxinolImage,
    216: barbaAzulImage,
    217: aFadaVoadoraImage,
    218: oCavaloEOHomemImage,
    219: aLendaDaLuaImage,
    220: oPescadorEOGenioImage,
    
    // Nível Médio (101-103, 111-115, 201-204)
    101: cigarraFormigaImage,
    102: lebreTartarugaImage,
    103: leaoRatoImage,
    111: patinhoFeioImage,
    112: joaoPeDeFeijaoImage,
    113: cinderelaImage,
    114: brancaDeNeveImage,
    115: flautistaHamelinImage,
    201: chapeuzinhoVermelhoImage,
    202: belaAdormecidaImage,
    203: rapunzelImage,
    204: pequenaSereiaImage,
    
    // Nível Difícil (301-310)
    301: pinocchioImage,
    302: alicePaisMaravilhasImage,
    303: robinsonCrusoeImage,
    304: ilhaDoTesouroImage,
    305: medicoMonstroImage,
    306: voltaAoMundo80DiasImage,
    307: heidiImage,
    308: tomSawyerImage,
    309: corcundaNotreDameImage,
    310: grimmHistoriasSelecionadasImage,
    
    // Nível Muito Difícil (401-405)
    401: domQuixoteImage,
    402: mobyDickImage,
    403: guerraEPazImage,
    404: irmaosKaramazovImage,
    405: crimeECastigoImage,
};

const Reading = () => {
  const { progress } = useProgress();
  const navigate = useNavigate();

  // Persisted difficulty with state so changing it re-renders the page
  const initialDifficulty = (localStorage.getItem(STORAGE_KEY) as Difficulty) || "easy";
  const [userDifficulty, setUserDifficulty] = useState<Difficulty>(initialDifficulty);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, userDifficulty);
  }, [userDifficulty]);

  const storiesByDifficulty = {
    easy: [
      // Fábulas
      { id: 104, title: "A Raposa e as Uvas", category: "Fábulas", xp: 25, stars: 2 },
      { id: 105, title: "A Galinha dos Ovos de Ouro", category: "Fábulas", xp: 35, stars: 2 },
      // Contos Clássicos
      { id: 205, title: "O Príncipe Sapo", category: "Contos Clássicos", xp: 65, stars: 3 },
      { id: 206, title: "Rumpelstiltskin", category: "Contos Clássicos", xp: 70, stars: 3 },
      { id: 207, title: "A Rainha da Neve (trechos)", category: "Contos Clássicos", xp: 80, stars: 3 },
      { id: 208, title: "A Gata Borralheira (versão clássica)", category: "Contos Clássicos", xp: 70, stars: 3 },
      { id: 209, title: "O Mágico de Oz (trechos)", category: "Contos Clássicos", xp: 90, stars: 4 },
      { id: 210, title: "O Pequeno Polegar", category: "Contos Clássicos", xp: 65, stars: 3 },
      // Contos
      { id: 211, title: "Os Três Porquinhos", category: "Contos", xp: 60, stars: 3 },
      { id: 212, title: "Pedro e o Lobo", category: "Contos", xp: 55, stars: 3 },
      { id: 213, title: "Simbad, o Marinheiro (trechos)", category: "Contos", xp: 95, stars: 4 },
      { id: 214, title: "Ali Babá e os Quarenta Ladrões (trechos)", category: "Contos", xp: 95, stars: 4 },
      { id: 215, title: "O Rouxinol", category: "Contos", xp: 65, stars: 3 },
      { id: 216, title: "Barba Azul (resumo)", category: "Contos", xp: 65, stars: 3 },
      { id: 217, title: "A Fada Voadora", category: "Contos", xp: 60, stars: 3 },
      { id: 218, title: "O Cavalo e o Homem", category: "Contos", xp: 60, stars: 3 },
      { id: 219, title: "A Lenda da Lua", category: "Contos", xp: 65, stars: 3 },
      { id: 220, title: "O Pescador e o Gênio", category: "Contos", xp: 70, stars: 3 },
    ],
    medium: [
      // Fábulas
      { id: 101, title: "A Cigarra e a Formiga", category: "Fábulas", xp: 35, stars: 2 },
      { id: 102, title: "A Lebre e a Tartaruga", category: "Fábulas", xp: 30, stars: 2 },
      { id: 103, title: "O Leão e o Rato", category: "Fábulas", xp: 30, stars: 2 },
      // Contos
      { id: 111, title: "O Patinho Feio", category: "Contos", xp: 45, stars: 3 },
      { id: 112, title: "João e o Pé de Feijão", category: "Contos", xp: 50, stars: 3 },
      { id: 113, title: "Cinderela", category: "Contos", xp: 55, stars: 3 },
      { id: 114, title: "Branca de Neve", category: "Contos", xp: 55, stars: 3 },
      { id: 115, title: "O Flautista de Hamelin", category: "Contos", xp: 45, stars: 3 },
      // Contos Clássicos
      { id: 201, title: "Chapeuzinho Vermelho", category: "Contos Clássicos", xp: 70, stars: 3 },
      { id: 202, title: "A Bela Adormecida", category: "Contos Clássicos", xp: 75, stars: 3 },
      { id: 203, title: "Rapunzel", category: "Contos Clássicos", xp: 70, stars: 3 },
      { id: 204, title: "A Pequena Sereia (versão resumida)", category: "Contos Clássicos", xp: 80, stars: 3 },
    ],
    hard: [
      // Clássicos (301-310)
      { id: 301, title: "Pinóquio", category: "Clássicos", xp: 120, stars: 4 },
      { id: 302, title: "Alice no País das Maravilhas", category: "Clássicos", xp: 130, stars: 4 },
      { id: 303, title: "As Aventuras de Robinson Crusoé", category: "Clássicos", xp: 150, stars: 4 },
      { id: 304, title: "A Ilha do Tesouro", category: "Clássicos", xp: 140, stars: 4 },
      { id: 305, title: "O Médico e o Monstro (trecho)", category: "Clássicos", xp: 125, stars: 4 },
      { id: 306, title: "A Volta ao Mundo em 80 Dias (trechos)", category: "Clássicos", xp: 150, stars: 4 },
      { id: 307, title: "Heidi (trechos)", category: "Clássicos", xp: 120, stars: 4 },
      { id: 308, title: "A História de Tom Sawyer (trechos)", category: "Clássicos", xp: 130, stars: 4 },
      { id: 309, title: "O Corcunda de Notre-Dame (trechos)", category: "Clássicos", xp: 140, stars: 4 },
      { id: 310, title: "Grimm: Histórias Selecionadas (trechos)", category: "Clássicos", xp: 125, stars: 4 },
    ],
    "very-hard": [
      // Clássicos (trechos) (401-405)
      { id: 401, title: "Dom Quixote (trechos)", category: "Clássicos", xp: 180, stars: 5 },
      { id: 402, title: "Moby Dick (trechos)", category: "Clássicos", xp: 200, stars: 5 },
      { id: 403, title: "Guerra e Paz (trecho simplificado)", category: "Clássicos", xp: 200, stars: 5 },
      { id: 404, title: "Os Irmãos Karamázov (trecho)", category: "Clássicos", xp: 200, stars: 5 },
      { id: 405, title: "Crime e Castigo (trecho)", category: "Clássicos", xp: 180, stars: 5 },
    ],
  } as const;

  const stories = storiesByDifficulty[userDifficulty];

  // Derive categories from the selected difficulty's stories
  const categories = Array.from(new Set(stories.map((s) => s.category)));
  const [selectedCategory, setSelectedCategory] = useState<string>(categories[0]);

  // Reset selected category whenever difficulty changes
  useEffect(() => {
    const newCategories = Array.from(new Set(storiesByDifficulty[userDifficulty].map((s) => s.category)));
    setSelectedCategory(newCategories[0]);
  }, [userDifficulty]);

  const filteredStories = stories.filter((story) => story.category === selectedCategory);

  return (
    <div className="min-h-screen pb-20 md:pb-8 md:pt-20">
      <Navigation />

      {/* HERO COLORIDO DO TOPO (com Header colorido ao lado) */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[hsl(302,95%,88%)] via-[hsl(48,100%,86%)] to-[hsl(198,95%,82%)] shadow-soft">
        {/* Mascote de fundo no HERO */}
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `url(${mascotBackground})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute -top-14 -left-16 h-64 w-64 rounded-full bg-[hsl(320,100%,86%)] opacity-60 blur-3xl" />
        <div className="absolute top-10 right-[-40px] h-56 w-56 rounded-full bg-[hsl(45,100%,88%)] opacity-60 blur-3xl" />
        <div className="absolute bottom-[-40px] left-10 h-72 w-72 rounded-full bg-[hsl(198,100%,84%)] opacity-60 blur-3xl" />
        <div className="relative z-10 container mx-auto px-4 py-12 md:py-16">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <img src={readingImage} alt="Leitura" className="w-20 h-20" />
              <ColorHeader
                title="Área de Leitura"
                subtitle={`Nível selecionado: ${userDifficulty === "easy" ? "Fácil" : userDifficulty === "medium" ? "Médio" : userDifficulty === "hard" ? "Difícil" : "Muito Difícil"}`}
                gradientFrom="#93c5fd"
                gradientTo="#c4b5fd"
              />
            </div>
            <div className="flex flex-col items-center gap-3">
              <LevelSelector value={userDifficulty} onChange={(d) => setUserDifficulty(d)} />
            </div>
          </div>
        </div>
      </section>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="container mx-auto px-4 py-8 space-y-10">
        {/* Progress */}
        <div>
          <ProgressBar currentXP={progress.xp} requiredXP={500} level={progress.level} />
        </div>

        {/* Stories Section */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[hsl(198,95%,80%)] via-[hsl(315,93%,82%)] to-[hsl(45,98%,75%)] px-6 py-10 shadow-glow md:px-12 md:py-14">
          {/* Mascote de fundo na seção principal */}
          <div
            className="absolute inset-0 opacity-20 z-0"
            style={{
              backgroundImage: `url(${mascotBackground})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
          
          <div className="absolute -top-24 -left-14 h-60 w-60 rounded-full bg-[hsl(200,100%,82%)] opacity-70 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 translate-y-1/3 rounded-full bg-[hsl(315,93%,78%)] opacity-70 blur-3xl" />
          <div className="absolute top-1/2 left-12 h-48 w-48 -translate-y-1/2 rounded-full bg-[hsl(45,100%,88%)] opacity-80 blur-3xl" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width=%27160%27 height=%27160%27 viewBox=%270 0 200 200%27 fill=%27none%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Ccircle cx=%2750%27 cy=%2750%27 r=%2720%27 fill=%27%23ffffff33%27/%3E%3Ccircle cx=%27160%27 cy=%2790%27 r=%2715%27 fill=%27%23ffffff33%27/%3E%3Ccircle cx=%2790%27 cy=%27160%27 r=%2725%27 fill=%27%23ffffff33%27/%3E%3C/svg%3E')] opacity-40" />

          <div className="relative z-10 space-y-8">
            {/* Categories */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {categories.map((category) => {
                const isActive = selectedCategory === category;
                return (
                  <Button
                    key={category}
                    variant={isActive ? "gradient" : "outline"}
                    className="min-w-[160px] font-body font-semibold shadow-soft"
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Button>
                );
              })}
            </div>

            {/* Stories Grid */}
            <div className="rounded-3xl bg-white/60 p-6 md:p-8 shadow-soft backdrop-blur-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStories.map((story) => {
                  const isCompleted = progress.completedStories.includes(story.id);
                  const storyImage = STORY_IMAGE_MAP[story.id];
                  
                  // Estilo de fundo aprimorado: aplica a imagem e um gradiente de sobreposição
                  const backgroundStyle = storyImage
                    ? {
                        backgroundImage: `url(${storyImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }
                    : {};

                  return (
                    <Card
                      key={story.id}
                      onClick={() => navigate(`/reading/${story.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          navigate(`/reading/${story.id}`);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={`p-0 hover:shadow-glow transition-smooth cursor-pointer border-2 animate-scale-in group relative overflow-hidden h-64 ${
                        isCompleted ? "border-success bg-success/5" : "border-border hover:border-primary"
                      }`}
                      style={backgroundStyle}
                    >
                      {/* Overlay para garantir legibilidade do texto */}
                      <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
                      
                      {/* Conteúdo do Card (Texto e Botões) */}
                      <div className="relative z-10 p-6 h-full flex flex-col justify-between text-white space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <span className="text-xs font-body font-semibold text-amber-300 uppercase">
                              {story.category}
                            </span>
                            <h3 className="text-xl font-display font-bold transition-smooth">
                              {story.title}
                            </h3>
                          </div>
                          <div className={`flex-shrink-0 p-2 rounded-full ${isCompleted ? "bg-success/20" : "bg-primary/10"}`}>
                            {isCompleted ? (
                              <CheckCircle className="w-5 h-5 text-success" />
                            ) : (
                              <BookOpen className="w-5 h-5 text-primary" />
                            )}
                          </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center gap-4 text-sm text-white/80">
                              <div className="flex items-center gap-1">
                                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                                <span>{story.xp} XP</span>
                              </div>
                            </div>

                            <Button
                              variant={isCompleted ? "outline" : "default"}
                              className="w-full bg-white text-primary hover:bg-gray-100"
                              onClick={(e) => {
                                // prevent the click on the button from bubbling up and causing double navigation side-effects
                                e.stopPropagation();
                                navigate(`/reading/${story.id}`);
                              }}
                            >
                              {isCompleted ? "✓ Completado" : "Começar Leitura"}
                            </Button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Reading;