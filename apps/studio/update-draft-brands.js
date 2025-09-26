import { getCliClient } from 'sanity/cli';

const client = getCliClient();

const draftBrandDescriptions = {
  'drafts.gryphon-brand-001':
    'Gryphon Audio Designs to duńska firma założona w 1985 roku przez Flemming E. Rasmussena, słynąca z produkcji najwyższej klasy sprzętu audio. Filozofia marki opiera się na bezkompromisowym dążeniu do doskonałości technicznej i muzycznej. Produkty Gryphon charakteryzują się monumentalną konstrukcją, wykorzystaniem najdroższych komponentów oraz innowacyjnych rozwiązań technicznych. Firma specjalizuje się w potężnych wzmacniaczach klasy A, zaawansowanych przedwzmacniaczach oraz głośnikach. Każdy element jest projektowany z myślą o odtworzeniu muzyki w sposób jak najbardziej naturalny i emocjonalny.',

  'drafts.usher-brand-001':
    'Usher Audio Technology to tajwańska firma założona w 1976 roku, specjalizująca się w produkcji wysokiej klasy głośników oraz wzmacniaczy. Marka znana jest z zaawansowanych rozwiązań technicznych, takich jak własne przetworniki ceramiczne oraz innowacyjne konstrukcje obudów. Produkty Usher charakteryzują się wyjątkową precyzją odtwarzania, szeroką sceną dźwiękową oraz naturalnym brzmieniem. Firma oferuje szeroką gamę głośników - od kompaktowych monitorów studyjnych, poprzez kolumny podłogowe, aż po masywne systemy referencyjne. Każdy produkt jest rezultatem wieloletnich badań i testów.',
};

async function updateDraftBrands() {
  console.log('Starting draft brand updates using CLI client...');

  for (const [brandId, text] of Object.entries(draftBrandDescriptions)) {
    try {
      console.log(`Updating draft brand ${brandId}...`);

      // Create portable text structure
      const description = [
        {
          _type: 'block',
          _key: `block-${Date.now()}`,
          style: 'normal',
          markDefs: [],
          children: [
            {
              _type: 'span',
              _key: `span-${Date.now()}`,
              text: text,
              marks: [],
            },
          ],
        },
      ];

      const result = await client.patch(brandId).set({ description }).commit();

      console.log(`✓ Updated ${brandId}`);
    } catch (error) {
      console.error(`✗ Failed to update ${brandId}:`, error.message);
    }
  }

  console.log('Draft brand updates completed!');
}

updateDraftBrands().catch(console.error);
