"""Vocabulary Drill: the built-in word list and the spaced-repetition memory.

Every word has its French form (with the article for nouns), the English meaning, a level
(A2, B1, B2 or C1) and an example sentence. In the example, {curly braces} mark the word
as it appears in the sentence: that part becomes the blank in "fill in the blank".
To add a word, add a W(...) line to its topic below; the checks at the bottom of this file
catch typos when the backend starts.

Your review schedule is saved in `sessions/vocab/progress.json` (git ignores `sessions/`).
Missed words come back the next day; each right answer pushes a word further away
(1, 3, 7, 16, then 35 days).
"""

import json
import random
import re
import unicodedata
from datetime import date, timedelta

from . import memory

DRILL_MODE = "vocabulary-drill"
INTERVALS = [1, 3, 7, 16, 35]  # days until the next review, after 1, 2, 3... right answers in a row
LEVELS = ["A1", "A2", "B1", "B2", "C1"]
ABOVE_SHARE = 0.25  # about a quarter of new words come from one level above yours

TOPICS = [
    {"id": "housing", "title": "Housing", "title_fr": "Le logement", "icon": "house"},
    {"id": "work", "title": "Work", "title_fr": "Le travail", "icon": "briefcase"},
    {"id": "health", "title": "Health", "title_fr": "La santé", "icon": "heart-pulse"},
    {"id": "environment", "title": "Environment", "title_fr": "L'environnement", "icon": "leaf"},
    {"id": "technology", "title": "Technology", "title_fr": "La technologie", "icon": "laptop"},
    {"id": "travel", "title": "Travel", "title_fr": "Les voyages", "icon": "plane"},
    {"id": "daily-life", "title": "Daily life", "title_fr": "La vie quotidienne", "icon": "coffee"},
    {"id": "connectors", "title": "Connectors", "title_fr": "Les connecteurs", "icon": "link",
     "blurb": "cependant, en revanche, d'ailleurs, autrement dit…"},
]
MIXED = {"id": "mixed", "title": "Mixed review", "title_fr": "Révision", "icon": "shuffle"}

WORDS: list[dict] = []
_topic = ""


def W(level, fr, en, example, example_en, gender=None, accept=()):
    """One word. `gender` is only needed for l'/les nouns (le/la/un/une show it already).
    `accept` lists other answers that count as right in "say it in French"."""
    WORDS.append({"topic": _topic, "level": level, "fr": fr, "en": en, "example": example,
                  "example_en": example_en, "gender": gender, "accept": list(accept)})


# ---------- Housing ----------
_topic = "housing"
W("A2", "le loyer", "rent", "Le {loyer} de mon appartement est de 1 200 dollars par mois.", "The rent for my apartment is 1,200 dollars a month.")
W("A2", "le quartier", "neighbourhood", "J'habite dans un {quartier} calme près du centre-ville.", "I live in a quiet neighbourhood near downtown.")
W("A2", "le propriétaire", "landlord, owner", "Le {propriétaire} habite au rez-de-chaussée.", "The landlord lives on the ground floor.")
W("A2", "louer", "to rent", "Nous voulons {louer} un appartement avec deux chambres.", "We want to rent an apartment with two bedrooms.")
W("A2", "déménager", "to move (house)", "Nous avons {déménagé} à Montréal l'été dernier.", "We moved to Montreal last summer.")
W("A2", "l'étage", "floor, storey", "Mon appartement est au troisième {étage}.", "My apartment is on the third floor.", gender="m")
W("A2", "la chambre", "bedroom", "La {chambre} des enfants est très lumineuse.", "The children's bedroom is very bright.")
W("A2", "le voisin", "neighbour", "Mon {voisin} m'aide souvent à porter mes courses.", "My neighbour often helps me carry my groceries.")
W("A2", "le salon", "living room", "Nous regardons la télévision dans le {salon}.", "We watch TV in the living room.")
W("B1", "le bail", "lease", "J'ai signé un {bail} d'un an.", "I signed a one-year lease.")
W("B1", "le colocataire", "roommate", "Mon {colocataire} fait toujours la vaisselle le soir.", "My roommate always does the dishes in the evening.")
W("B1", "les charges", "utilities, service charges", "Le loyer est de 900 dollars, {charges} comprises.", "The rent is 900 dollars, utilities included.", gender="f")
W("B1", "meublé", "furnished", "Je cherche un studio {meublé} pour six mois.", "I'm looking for a furnished studio for six months.")
W("B1", "le chauffage", "heating", "En hiver, le {chauffage} coûte cher au Canada.", "In winter, heating is expensive in Canada.")
W("B1", "la banlieue", "suburbs", "Beaucoup de familles préfèrent vivre en {banlieue}.", "Many families prefer to live in the suburbs.")
W("B1", "le dépôt de garantie", "security deposit", "Le propriétaire demande un {dépôt de garantie} d'un mois de loyer.", "The landlord asks for a security deposit of one month's rent.")
W("B1", "spacieux", "spacious", "Le salon est {spacieux} et bien éclairé.", "The living room is spacious and well lit.")
W("B1", "l'ascenseur", "elevator", "L'{ascenseur} est en panne depuis lundi.", "The elevator has been out of order since Monday.", gender="m")
W("B1", "les travaux", "renovation work", "Les {travaux} dans la salle de bain vont durer deux semaines.", "The work in the bathroom will last two weeks.", gender="m")
W("B2", "le logement social", "social housing", "Le gouvernement veut construire plus de {logements sociaux}.", "The government wants to build more social housing.")
W("B2", "la pénurie de logements", "housing shortage", "Les grandes villes canadiennes font face à une {pénurie de logements}.", "Large Canadian cities are facing a housing shortage.")
W("B2", "le locataire", "tenant", "Le {locataire} doit prévenir le propriétaire deux mois avant de partir.", "The tenant must notify the landlord two months before leaving.")
W("B2", "résilier", "to terminate (a contract)", "J'ai dû {résilier} mon bail avant la fin.", "I had to terminate my lease before the end.")
W("B2", "emménager", "to move in", "Nous allons {emménager} dans notre nouvel appartement samedi.", "We're going to move into our new apartment on Saturday.")
W("B2", "insalubre", "unfit to live in", "Ce vieil immeuble est devenu {insalubre}.", "This old building has become unfit to live in.")
W("B2", "la hausse des loyers", "rent increase", "La {hausse des loyers} inquiète beaucoup d'étudiants.", "The rise in rents worries many students.")
W("B2", "abordable", "affordable", "Il est difficile de trouver un logement {abordable} à Toronto.", "It's hard to find affordable housing in Toronto.")
W("C1", "la flambée des prix", "price surge", "La {flambée des prix} de l'immobilier exclut les jeunes du marché.", "The surge in property prices is shutting young people out of the market.")
W("C1", "l'embourgeoisement", "gentrification", "L'{embourgeoisement} du quartier a fait partir les anciens habitants.", "The gentrification of the neighbourhood drove out its long-time residents.", gender="m")
W("C1", "exigu", "cramped", "Ils vivent à quatre dans un appartement {exigu}.", "The four of them live in a cramped apartment.")
W("C1", "le parc immobilier", "housing stock", "Le {parc immobilier} de la ville est vieillissant.", "The city's housing stock is ageing.")
W("C1", "expulser", "to evict", "Le propriétaire n'a pas le droit d'{expulser} un locataire en plein hiver.", "The landlord isn't allowed to evict a tenant in the middle of winter.")

# ---------- Work ----------
_topic = "work"
W("A2", "le métier", "job, trade", "Quel {métier} voulez-vous faire au Canada ?", "What job do you want to do in Canada?")
W("A2", "le collègue", "colleague", "Mon {collègue} m'aide quand j'ai un problème.", "My colleague helps me when I have a problem.")
W("A2", "le salaire", "salary", "Son {salaire} a augmenté cette année.", "Her salary went up this year.")
W("A2", "l'entreprise", "company", "Je travaille dans une petite {entreprise} de logiciels.", "I work in a small software company.", gender="f")
W("A2", "le patron", "boss", "Le {patron} organise une réunion chaque lundi.", "The boss holds a meeting every Monday.")
W("A2", "la réunion", "meeting", "La {réunion} commence à neuf heures.", "The meeting starts at nine o'clock.")
W("A2", "à temps partiel", "part-time", "Ma sœur travaille {à temps partiel} dans un café.", "My sister works part-time in a café.")
W("A2", "le bureau", "office", "Je vais au {bureau} en métro.", "I go to the office by metro.")
W("B1", "le CV", "résumé, CV", "J'ai envoyé mon {CV} à trois entreprises.", "I sent my résumé to three companies.")
W("B1", "l'entretien d'embauche", "job interview", "J'ai un {entretien d'embauche} demain matin.", "I have a job interview tomorrow morning.", gender="m")
W("B1", "embaucher", "to hire", "Cette entreprise va {embaucher} vingt personnes.", "This company is going to hire twenty people.")
W("B1", "le poste", "position, job", "Le {poste} demande trois ans d'expérience.", "The position requires three years of experience.")
W("B1", "les heures supplémentaires", "overtime", "Je fais souvent des {heures supplémentaires} le vendredi.", "I often work overtime on Fridays.", gender="f")
W("B1", "le télétravail", "remote work", "Je fais du {télétravail} deux jours par semaine.", "I work from home two days a week.")
W("B1", "démissionner", "to resign, to quit", "Elle a {démissionné} pour créer sa propre entreprise.", "She quit to start her own company.")
W("B1", "le chômage", "unemployment", "Le taux de {chômage} a baissé cette année.", "The unemployment rate went down this year.")
W("B1", "les congés payés", "paid leave", "En France, les salariés ont cinq semaines de {congés payés}.", "In France, employees get five weeks of paid leave.", gender="m")
W("B2", "la reconversion professionnelle", "career change", "Après dix ans dans la vente, il a choisi une {reconversion professionnelle}.", "After ten years in sales, he chose a career change.")
W("B2", "la conciliation travail-famille", "work-life balance", "La {conciliation travail-famille} est importante pour les jeunes parents.", "Work-life balance is important for young parents.")
W("B2", "le licenciement", "dismissal, layoff", "L'usine a annoncé cent {licenciements}.", "The factory announced a hundred layoffs.")
W("B2", "l'épuisement professionnel", "burnout", "L'{épuisement professionnel} touche de plus en plus de salariés.", "Burnout affects more and more employees.", gender="m")
W("B2", "le préavis", "notice (period)", "Je dois donner un {préavis} de deux semaines à mon employeur.", "I have to give my employer two weeks' notice.")
W("B2", "l'ordre professionnel", "professional order (regulatory body)", "Les infirmières formées à l'étranger doivent s'inscrire à un {ordre professionnel}.", "Nurses trained abroad must register with a professional order.", gender="m")
W("B2", "polyvalent", "versatile", "Nous cherchons un employé {polyvalent} et motivé.", "We're looking for a versatile, motivated employee.")
W("B2", "négocier", "to negotiate", "Il faut savoir {négocier} son salaire.", "You need to know how to negotiate your salary.")
W("C1", "la précarité", "(job) insecurity", "La {précarité} de l'emploi touche surtout les jeunes.", "Job insecurity mainly affects young people.")
W("C1", "le savoir-faire", "know-how", "Cette entreprise est connue pour son {savoir-faire} artisanal.", "This company is known for its craftsmanship.")
W("C1", "la pénibilité", "arduousness (of work)", "On parle beaucoup de la {pénibilité} de certains métiers.", "People talk a lot about how gruelling some jobs are.")
W("C1", "briguer", "to seek (a post)", "Elle compte {briguer} un poste de direction.", "She intends to seek a management position.")
W("C1", "la main-d'œuvre", "workforce, labour", "Le Canada manque de {main-d'œuvre} qualifiée.", "Canada lacks skilled labour.")

# ---------- Health ----------
_topic = "health"
W("A2", "le médecin", "doctor", "Je dois prendre rendez-vous chez le {médecin}.", "I need to make an appointment with the doctor.")
W("A2", "la pharmacie", "pharmacy", "La {pharmacie} ferme à vingt et une heures.", "The pharmacy closes at 9 p.m.")
W("A2", "la fièvre", "fever", "Mon fils a de la {fièvre} depuis hier soir.", "My son has had a fever since last night.")
W("A2", "le rhume", "cold", "J'ai attrapé un {rhume} pendant le week-end.", "I caught a cold over the weekend.")
W("A2", "l'ordonnance", "prescription", "Le médecin m'a donné une {ordonnance} pour des antibiotiques.", "The doctor gave me a prescription for antibiotics.", gender="f")
W("A2", "le rendez-vous", "appointment", "J'ai un {rendez-vous} chez le dentiste jeudi.", "I have a dentist appointment on Thursday.")
W("A2", "malade", "sick, ill", "Je suis {malade}, je reste à la maison aujourd'hui.", "I'm sick, I'm staying home today.")
W("A2", "les urgences", "emergency room", "Nous avons attendu cinq heures aux {urgences}.", "We waited five hours in the emergency room.", gender="f")
W("B1", "la carte d'assurance maladie", "health insurance card", "N'oubliez pas votre {carte d'assurance maladie} à l'hôpital.", "Don't forget your health insurance card at the hospital.")
W("B1", "le médecin de famille", "family doctor", "Il est difficile de trouver un {médecin de famille} au Québec.", "It's hard to find a family doctor in Quebec.")
W("B1", "guérir", "to heal, to get better", "Avec du repos, vous allez vite {guérir}.", "With some rest, you'll get better quickly.")
W("B1", "la douleur", "pain", "Je ressens une {douleur} dans le dos.", "I feel a pain in my back.")
W("B1", "le sommeil", "sleep", "Le {sommeil} est essentiel pour rester en bonne santé.", "Sleep is essential to stay healthy.")
W("B1", "le régime", "diet", "Elle suit un {régime} sans sucre.", "She's on a sugar-free diet.")
W("B1", "se blesser", "to get hurt", "Il s'est {blessé} au genou en jouant au soccer.", "He hurt his knee playing soccer.")
W("B1", "la santé mentale", "mental health", "Il faut parler plus ouvertement de la {santé mentale}.", "We need to talk more openly about mental health.")
W("B1", "le vaccin", "vaccine", "Le {vaccin} contre la grippe est gratuit pour les personnes âgées.", "The flu vaccine is free for older people.")
W("B2", "le délai d'attente", "waiting time", "Le {délai d'attente} pour voir un spécialiste est de plusieurs mois.", "The wait to see a specialist is several months.")
W("B2", "la prévention", "prevention", "La {prévention} coûte moins cher que les traitements.", "Prevention costs less than treatment.")
W("B2", "le système de santé", "healthcare system", "Le {système de santé} canadien est financé par les impôts.", "The Canadian healthcare system is funded by taxes.")
W("B2", "sédentaire", "sedentary", "Un mode de vie {sédentaire} augmente les risques de maladie.", "A sedentary lifestyle increases the risk of illness.")
W("B2", "les effets secondaires", "side effects", "Ce médicament peut avoir des {effets secondaires}.", "This medicine can have side effects.", gender="m")
W("B2", "soigner", "to treat, to care for", "Les infirmières {soignent} les patients jour et nuit.", "Nurses care for patients day and night.")
W("B2", "le dépistage", "screening", "Le {dépistage} précoce sauve des vies.", "Early screening saves lives.")
W("B2", "s'aggraver", "to get worse", "Si les symptômes s'{aggravent}, appelez le 811.", "If the symptoms get worse, call 811.")
W("C1", "le personnel soignant", "healthcare staff", "Le manque de {personnel soignant} fragilise les hôpitaux.", "The shortage of healthcare staff is weakening hospitals.")
W("C1", "l'espérance de vie", "life expectancy", "L'{espérance de vie} a beaucoup augmenté en un siècle.", "Life expectancy has risen a lot in a century.", gender="f")
W("C1", "le surmenage", "overwork", "Son malaise est dû au {surmenage}.", "His fainting spell was caused by overwork.")
W("C1", "enrayer", "to curb, to halt", "Les autorités tentent d'{enrayer} l'épidémie.", "The authorities are trying to curb the epidemic.")
W("C1", "la gratuité des soins", "free healthcare", "La {gratuité des soins} est un principe important au Canada.", "Free healthcare is an important principle in Canada.")

# ---------- Environment ----------
_topic = "environment"
W("A2", "le recyclage", "recycling", "Le {recyclage} est obligatoire dans ma ville.", "Recycling is mandatory in my city.")
W("A2", "la pollution", "pollution", "La {pollution} de l'air est un problème dans les grandes villes.", "Air pollution is a problem in big cities.")
W("A2", "les déchets", "waste, garbage", "Nous trions nos {déchets} chaque semaine.", "We sort our waste every week.", gender="m")
W("A2", "économiser", "to save", "Il faut {économiser} l'eau.", "We need to save water.")
W("A2", "la poubelle", "garbage can", "Mets les bouteilles dans la {poubelle} bleue.", "Put the bottles in the blue bin.")
W("A2", "le climat", "climate", "Le {climat} change rapidement.", "The climate is changing quickly.")
W("A2", "les transports en commun", "public transit", "Je prends les {transports en commun} pour aller au travail.", "I take public transit to get to work.", gender="m")
W("A2", "jeter", "to throw away", "Ne {jetez} pas vos papiers par terre.", "Don't throw your papers on the ground.")
W("B1", "le réchauffement climatique", "global warming", "Le {réchauffement climatique} fait fondre les glaciers.", "Global warming is melting the glaciers.")
W("B1", "l'énergie renouvelable", "renewable energy", "Le Québec produit beaucoup d'{énergie renouvelable}.", "Quebec produces a lot of renewable energy.", gender="f")
W("B1", "protéger", "to protect", "Nous devons {protéger} les forêts.", "We must protect the forests.")
W("B1", "gaspiller", "to waste", "Beaucoup de familles {gaspillent} de la nourriture.", "Many families waste food.")
W("B1", "le compost", "compost", "Nous mettons les épluchures dans le {compost}.", "We put the peelings in the compost.")
W("B1", "les gaz à effet de serre", "greenhouse gases", "Les voitures émettent des {gaz à effet de serre}.", "Cars give off greenhouse gases.", gender="m")
W("B1", "la sécheresse", "drought", "La {sécheresse} a détruit une partie des récoltes.", "The drought destroyed part of the harvest.")
W("B1", "écologique", "eco-friendly", "Le vélo est un moyen de transport {écologique}.", "Cycling is an eco-friendly way to get around.")
W("B1", "les feux de forêt", "forest fires", "Les {feux de forêt} ont été nombreux cet été.", "There were many forest fires this summer.", gender="m")
W("B2", "l'empreinte carbone", "carbon footprint", "Prendre l'avion augmente beaucoup votre {empreinte carbone}.", "Flying greatly increases your carbon footprint.", gender="f")
W("B2", "la biodiversité", "biodiversity", "La {biodiversité} diminue partout dans le monde.", "Biodiversity is declining all over the world.")
W("B2", "le développement durable", "sustainable development", "L'entreprise a un plan de {développement durable}.", "The company has a sustainable development plan.")
W("B2", "réduire", "to reduce", "Il faut {réduire} notre consommation de plastique.", "We need to reduce our use of plastic.")
W("B2", "les intempéries", "bad weather", "Les {intempéries} ont causé des pannes d'électricité.", "The bad weather caused power outages.", gender="f")
W("B2", "la transition énergétique", "energy transition", "La {transition énergétique} demande de gros investissements.", "The energy transition requires big investments.")
W("B2", "nuisible", "harmful", "Ces produits chimiques sont {nuisibles} pour la santé.", "These chemicals are harmful to health.")
W("B2", "les combustibles fossiles", "fossil fuels", "Nous dépendons encore trop des {combustibles fossiles}.", "We still depend too much on fossil fuels.", gender="m")
W("C1", "l'écoanxiété", "eco-anxiety", "L'{écoanxiété} touche de nombreux jeunes.", "Eco-anxiety affects many young people.", gender="f")
W("C1", "pallier", "to make up for", "Il faut trouver des solutions pour {pallier} le manque d'eau.", "We have to find solutions to make up for the lack of water.")
W("C1", "la surconsommation", "overconsumption", "La {surconsommation} épuise les ressources de la planète.", "Overconsumption is draining the planet's resources.")
W("C1", "l'écoblanchiment", "greenwashing", "Cette publicité est un exemple d'{écoblanchiment}.", "This ad is an example of greenwashing.", gender="m")
W("C1", "endiguer", "to contain, to stem", "Les pompiers n'arrivent pas à {endiguer} l'incendie.", "The firefighters can't contain the fire.")

# ---------- Technology ----------
_topic = "technology"
W("A2", "l'ordinateur", "computer", "Mon {ordinateur} est trop lent.", "My computer is too slow.", gender="m")
W("A2", "le cellulaire", "cell phone", "J'ai oublié mon {cellulaire} à la maison.", "I left my cell phone at home.")
W("A2", "le courriel", "email", "Je vous envoie un {courriel} ce soir.", "I'll send you an email this evening.")
W("A2", "le mot de passe", "password", "J'ai oublié mon {mot de passe}.", "I forgot my password.")
W("A2", "télécharger", "to download", "Vous pouvez {télécharger} l'application gratuitement.", "You can download the app for free.")
W("A2", "l'écran", "screen", "L'{écran} de ma tablette est cassé.", "My tablet's screen is broken.", gender="m")
W("A2", "le site web", "website", "Les horaires sont sur le {site web} de la bibliothèque.", "The opening hours are on the library's website.")
W("A2", "envoyer", "to send", "Je t'ai {envoyé} les photos hier.", "I sent you the photos yesterday.")
W("B1", "le réseau social", "social network", "Elle passe des heures sur les {réseaux sociaux}.", "She spends hours on social media.")
W("B1", "l'application", "app", "Cette {application} m'aide à apprendre le français.", "This app helps me learn French.", gender="f")
W("B1", "la mise à jour", "update", "Il faut faire la {mise à jour} de votre téléphone.", "You need to update your phone.")
W("B1", "en ligne", "online", "J'achète presque tout {en ligne}.", "I buy almost everything online.")
W("B1", "le logiciel", "software", "Ce {logiciel} est facile à utiliser.", "This software is easy to use.")
W("B1", "sauvegarder", "to save, to back up", "N'oublie pas de {sauvegarder} ton document.", "Don't forget to save your document.")
W("B1", "les internautes", "internet users", "Beaucoup d'{internautes} partagent leurs données sans le savoir.", "Many internet users share their data without knowing it.", gender="m")
W("B1", "la panne", "breakdown, outage", "Une {panne} d'électricité a coupé Internet.", "A power outage cut off the internet.")
W("B1", "le clavier", "keyboard", "Le {clavier} de cet ordinateur est en anglais.", "This computer's keyboard is in English.")
W("B2", "l'intelligence artificielle", "artificial intelligence", "L'{intelligence artificielle} transforme le monde du travail.", "Artificial intelligence is transforming the world of work.", gender="f")
W("B2", "les données personnelles", "personal data", "Il faut protéger vos {données personnelles}.", "You need to protect your personal data.", gender="f")
W("B2", "la vie privée", "privacy", "Les réseaux sociaux menacent notre {vie privée}.", "Social networks threaten our privacy.")
W("B2", "le piratage", "hacking", "L'entreprise a été victime d'un {piratage} informatique.", "The company was the victim of a computer hack.")
W("B2", "l'hameçonnage", "phishing", "Ce courriel est une tentative d'{hameçonnage}.", "This email is a phishing attempt.", gender="m")
W("B2", "la dépendance aux écrans", "screen addiction", "La {dépendance aux écrans} inquiète les parents.", "Screen addiction worries parents.")
W("B2", "numérique", "digital", "Les services {numériques} remplacent peu à peu les guichets.", "Digital services are gradually replacing service counters.")
W("B2", "l'infonuagique", "cloud computing", "Nos fichiers sont stockés grâce à l'{infonuagique}.", "Our files are stored using cloud computing.", gender="f")
W("C1", "la fracture numérique", "digital divide", "La {fracture numérique} isole certaines personnes âgées.", "The digital divide isolates some older people.")
W("C1", "l'obsolescence programmée", "planned obsolescence", "L'{obsolescence programmée} oblige à changer souvent d'appareil.", "Planned obsolescence forces people to change devices often.", gender="f")
W("C1", "la désinformation", "disinformation", "La {désinformation} circule très vite sur Internet.", "Disinformation spreads very fast on the internet.")
W("C1", "l'essor", "rise, boom", "L'{essor} du commerce en ligne a changé nos habitudes.", "The boom in online shopping has changed our habits.", gender="m")
W("C1", "chronophage", "time-consuming", "Les réseaux sociaux sont très {chronophages}.", "Social media is very time-consuming.")

# ---------- Travel ----------
_topic = "travel"
W("A2", "la valise", "suitcase", "J'ai fait ma {valise} hier soir.", "I packed my suitcase last night.")
W("A2", "le billet", "ticket", "J'ai acheté un {billet} d'avion pour Paris.", "I bought a plane ticket to Paris.")
W("A2", "l'aéroport", "airport", "Nous arrivons à l'{aéroport} à six heures.", "We arrive at the airport at six o'clock.", gender="m")
W("A2", "la gare", "train station", "Le train part de la {gare} centrale.", "The train leaves from the central station.")
W("A2", "réserver", "to book", "J'ai {réservé} une chambre d'hôtel pour trois nuits.", "I booked a hotel room for three nights.")
W("A2", "le passeport", "passport", "N'oubliez pas votre {passeport} !", "Don't forget your passport!")
W("A2", "les vacances", "vacation, holidays", "Nous partons en {vacances} au mois de juillet.", "We're going on vacation in July.", gender="f")
W("A2", "le vol", "flight", "Le {vol} pour Vancouver a deux heures de retard.", "The flight to Vancouver is two hours late.")
W("B1", "l'aller-retour", "round trip", "Un {aller-retour} Montréal-Québec coûte environ cent dollars.", "A Montreal–Quebec City round trip costs about a hundred dollars.", gender="m")
W("B1", "l'hébergement", "accommodation", "L'{hébergement} est compris dans le prix du voyage.", "Accommodation is included in the price of the trip.", gender="m")
W("B1", "la correspondance", "connection (transport)", "J'ai raté ma {correspondance} à Toronto.", "I missed my connection in Toronto.")
W("B1", "les bagages", "luggage", "Mes {bagages} sont restés à Paris.", "My luggage stayed in Paris.", gender="m")
W("B1", "la douane", "customs", "Il faut déclarer ces produits à la {douane}.", "You have to declare these goods at customs.")
W("B1", "annuler", "to cancel", "La compagnie a {annulé} notre vol à cause de la neige.", "The airline cancelled our flight because of the snow.")
W("B1", "le séjour", "stay", "Notre {séjour} en Gaspésie était magnifique.", "Our stay in the Gaspé was wonderful.")
W("B1", "l'itinéraire", "itinerary, route", "Nous avons préparé notre {itinéraire} avant de partir.", "We planned our route before leaving.", gender="m")
W("B1", "la randonnée", "hike", "Nous avons fait une belle {randonnée} dans les Rocheuses.", "We went on a lovely hike in the Rockies.")
W("B2", "le dépaysement", "change of scenery", "J'aime le {dépaysement} quand je voyage.", "I love the change of scenery when I travel.")
W("B2", "le décalage horaire", "jet lag, time difference", "Avec le {décalage horaire}, je n'ai pas dormi de la nuit.", "With the jet lag, I didn't sleep all night.")
W("B2", "le tourisme de masse", "mass tourism", "Le {tourisme de masse} abîme certains sites naturels.", "Mass tourism damages some natural sites.")
W("B2", "l'escale", "stopover", "Nous ferons une {escale} de deux heures à Reykjavik.", "We'll have a two-hour stopover in Reykjavik.", gender="f")
W("B2", "sillonner", "to travel all over", "Ils ont {sillonné} le Canada en camping-car.", "They travelled all over Canada in a camper van.")
W("B2", "l'auberge de jeunesse", "youth hostel", "Nous avons dormi dans une {auberge de jeunesse}.", "We slept in a youth hostel.", gender="f")
W("B2", "la haute saison", "peak season", "Les prix augmentent pendant la {haute saison}.", "Prices go up during peak season.")
W("B2", "le contrôle de sécurité", "security check", "Le {contrôle de sécurité} a duré une heure.", "The security check took an hour.")
W("C1", "le périple", "long journey", "Après un long {périple} à travers l'Asie, il est rentré chez lui.", "After a long journey across Asia, he came home.")
W("C1", "l'imprévu", "unexpected event", "Il faut toujours prévoir un budget pour les {imprévus}.", "You should always budget for the unexpected.", gender="m")
W("C1", "dépaysant", "refreshingly different", "Ce voyage au Maroc était vraiment {dépaysant}.", "This trip to Morocco was a real change of scene.")
W("C1", "le surtourisme", "overtourism", "Venise souffre du {surtourisme}.", "Venice suffers from overtourism.")
W("C1", "s'aventurer", "to venture", "Nous nous sommes {aventurés} hors des sentiers battus.", "We ventured off the beaten track.")

# ---------- Daily life ----------
_topic = "daily-life"
W("A2", "les courses", "groceries, shopping", "Je fais les {courses} le samedi matin.", "I do the grocery shopping on Saturday mornings.", gender="f")
W("A2", "le petit-déjeuner", "breakfast", "Je prends mon {petit-déjeuner} à sept heures.", "I have breakfast at seven.")
W("A2", "se lever", "to get up", "Je me {lève} tôt pendant la semaine.", "I get up early during the week.")
W("A2", "le ménage", "housework, cleaning", "Le dimanche, je fais le {ménage}.", "On Sundays, I do the cleaning.")
W("A2", "la boulangerie", "bakery", "J'achète du pain à la {boulangerie} du coin.", "I buy bread at the bakery on the corner.")
W("A2", "le trajet", "commute, trip", "Mon {trajet} pour aller au travail dure trente minutes.", "My commute to work takes thirty minutes.")
W("A2", "les loisirs", "hobbies, free-time activities", "Quels sont vos {loisirs} préférés ?", "What are your favourite hobbies?", gender="m")
W("A2", "la vaisselle", "the dishes", "Après le dîner, je fais la {vaisselle}.", "After dinner, I do the dishes.")
W("B1", "l'épicerie", "grocery store", "Il y a une {épicerie} ouverte jusqu'à minuit près de chez moi.", "There's a grocery store open until midnight near my place.", gender="f")
W("B1", "le quotidien", "daily life", "Le sport fait partie de mon {quotidien}.", "Sport is part of my daily life.")
W("B1", "se détendre", "to relax", "Le soir, je lis pour me {détendre}.", "In the evening, I read to relax.")
W("B1", "le bénévolat", "volunteering", "Je fais du {bénévolat} dans une banque alimentaire.", "I volunteer at a food bank.")
W("B1", "la garderie", "daycare", "Ma fille va à la {garderie} trois jours par semaine.", "My daughter goes to daycare three days a week.")
W("B1", "s'inscrire", "to sign up, to register", "Je voudrais m'{inscrire} à un cours de natation.", "I'd like to sign up for a swimming class.")
W("B1", "le voisinage", "neighbours, neighbourhood", "Nous avons de bonnes relations avec le {voisinage}.", "We get on well with the neighbours.")
W("B1", "l'heure de pointe", "rush hour", "À l'{heure de pointe}, le métro est plein.", "At rush hour, the metro is packed.", gender="f")
W("B1", "se débrouiller", "to manage, to get by", "Je me {débrouille} bien en français maintenant.", "I get by well in French now.")
W("B2", "les tâches ménagères", "household chores", "Nous partageons les {tâches ménagères} à la maison.", "We share the household chores at home.", gender="f")
W("B2", "le pouvoir d'achat", "purchasing power", "L'inflation réduit le {pouvoir d'achat} des familles.", "Inflation reduces families' purchasing power.")
W("B2", "concilier", "to balance, to reconcile", "Il n'est pas facile de {concilier} travail et vie de famille.", "It isn't easy to balance work and family life.")
W("B2", "le mode de vie", "lifestyle", "Notre {mode de vie} a beaucoup changé depuis la pandémie.", "Our lifestyle has changed a lot since the pandemic.")
W("B2", "les démarches administratives", "paperwork, formalities", "Les {démarches administratives} prennent du temps quand on arrive au Canada.", "Paperwork takes time when you arrive in Canada.", gender="f")
W("B2", "l'entraide", "mutual help", "L'{entraide} entre voisins est importante en hiver.", "Neighbours helping each other matters in winter.", gender="f")
W("B2", "s'adapter", "to adapt", "Il m'a fallu du temps pour m'{adapter} au froid.", "It took me a while to adapt to the cold.")
W("B2", "boucler ses fins de mois", "to make ends meet", "Avec la hausse des prix, beaucoup de familles ont du mal à {boucler leurs fins de mois}.", "With rising prices, many families struggle to make ends meet.")
W("C1", "le train-train quotidien", "daily grind", "Les vacances me sortent du {train-train quotidien}.", "Holidays get me out of the daily grind.")
W("C1", "la flânerie", "strolling", "J'aime la {flânerie} dans les rues du Vieux-Québec.", "I love strolling through the streets of Old Quebec.")
W("C1", "être débordé", "to be swamped", "Cette semaine, je suis complètement {débordé}.", "This week, I'm completely swamped.", accept=("débordé", "débordée"))
W("C1", "le lien social", "social ties", "Les associations de quartier renforcent le {lien social}.", "Neighbourhood associations strengthen social ties.")
W("C1", "chiner", "to hunt for bargains", "Le dimanche, j'aime {chiner} dans les marchés aux puces.", "On Sundays, I like bargain hunting at flea markets.")

# ---------- Connectors ----------
_topic = "connectors"
W("A2", "mais", "but", "J'aime l'hiver, {mais} je déteste avoir froid.", "I like winter, but I hate being cold.")
W("A2", "parce que", "because", "Je reste à la maison {parce que} je suis fatigué.", "I'm staying home because I'm tired.")
W("A2", "donc", "so, therefore", "Il pleut, {donc} je prends mon parapluie.", "It's raining, so I'm taking my umbrella.")
W("A2", "ensuite", "then, next", "D'abord, je prends une douche, {ensuite} je m'habille.", "First I take a shower, then I get dressed.")
W("A2", "d'abord", "first, first of all", "{D'abord}, je voudrais me présenter.", "First of all, I'd like to introduce myself.")
W("A2", "aussi", "also, too", "Je parle anglais et {aussi} un peu espagnol.", "I speak English and also a little Spanish.")
W("A2", "par exemple", "for example", "J'aime les sports d'hiver, {par exemple} le ski.", "I like winter sports, for example skiing.")
W("A2", "enfin", "finally", "{Enfin}, je voudrais remercier mes collègues.", "Finally, I'd like to thank my colleagues.")
W("B1", "cependant", "however", "Le loyer est cher ; {cependant}, l'appartement est très bien situé.", "The rent is high; however, the apartment is very well located.")
W("B1", "pourtant", "yet, even so", "Il a beaucoup étudié, {pourtant} il a raté l'examen.", "He studied a lot, yet he failed the exam.")
W("B1", "alors que", "whereas, while", "Mon frère adore le froid, {alors que} moi, je préfère l'été.", "My brother loves the cold, whereas I prefer summer.")
W("B1", "grâce à", "thanks to", "J'ai trouvé ce travail {grâce à} un ami.", "I found this job thanks to a friend.")
W("B1", "à cause de", "because of", "Le vol est annulé {à cause de} la tempête.", "The flight is cancelled because of the storm.")
W("B1", "par contre", "on the other hand", "La ville est belle ; {par contre}, l'hiver est très long.", "The city is beautiful; on the other hand, winter is very long.")
W("B1", "puisque", "since, given that", "{Puisque} tu es libre ce soir, viens dîner avec nous.", "Since you're free tonight, come and have dinner with us.")
W("B1", "d'ailleurs", "besides, in fact", "J'adore Montréal ; {d'ailleurs}, j'y retourne cet été.", "I love Montreal; in fact, I'm going back this summer.")
W("B1", "au lieu de", "instead of", "Prends le vélo {au lieu de} la voiture.", "Take the bike instead of the car.")
W("B2", "en revanche", "on the other hand", "Le salaire est bas ; {en revanche}, les horaires sont flexibles.", "The pay is low; on the other hand, the hours are flexible.")
W("B2", "bien que", "although (+ subjunctive)", "{Bien que} la vie soit chère, j'aime vivre ici.", "Although life is expensive, I like living here.")
W("B2", "autrement dit", "in other words", "Le poste est temporaire ; {autrement dit}, le contrat dure six mois.", "The position is temporary; in other words, the contract lasts six months.")
W("B2", "néanmoins", "nevertheless", "Ce projet est difficile ; {néanmoins}, il est passionnant.", "This project is difficult; nevertheless, it's exciting.")
W("B2", "en effet", "indeed", "Ce quartier est agréable. {En effet}, il y a beaucoup de parcs.", "This neighbourhood is pleasant. Indeed, there are lots of parks.")
W("B2", "afin de", "in order to", "Je prends des cours {afin de} réussir le TCF.", "I'm taking classes in order to pass the TCF.")
W("B2", "par conséquent", "consequently", "Les prix augmentent ; {par conséquent}, les gens consomment moins.", "Prices are rising; consequently, people are buying less.")
W("B2", "quant à", "as for", "J'aime le ski. {Quant à} mon mari, il préfère rester au chaud.", "I like skiing. As for my husband, he prefers to stay warm.")
W("C1", "certes", "admittedly", "{Certes}, la vie est chère à Vancouver, mais les salaires sont plus élevés.", "Admittedly, life is expensive in Vancouver, but salaries are higher.")
W("C1", "en somme", "in short", "{En somme}, cette expérience m'a beaucoup appris.", "In short, this experience taught me a lot.")
W("C1", "toutefois", "however", "Le plan est bon ; il faudra {toutefois} trouver un financement.", "The plan is good; we will, however, need to find funding.")
W("C1", "dans la mesure où", "insofar as", "Le télétravail est utile {dans la mesure où} il réduit les trajets.", "Remote work is useful insofar as it cuts down on commuting.")
W("C1", "quoi qu'il en soit", "be that as it may", "{Quoi qu'il en soit}, nous devons prendre une décision.", "Be that as it may, we have to make a decision.")
W("C1", "en outre", "furthermore", "{En outre}, ce logement est proche des écoles.", "Furthermore, this home is close to schools.")


# ---------- Words: ids, articles and checks ----------

def plain(text: str) -> str:
    """Lowercase, no accents, œ → oe, curly apostrophes made straight (for matching and ids)."""
    text = text.lower().replace("’", "'").replace("œ", "oe").replace("æ", "ae")
    return "".join(c for c in unicodedata.normalize("NFD", text) if not unicodedata.combining(c))


ARTICLE = re.compile(r"^(le |la |les |l')", re.IGNORECASE)


def _finish(word: dict) -> None:
    word["id"] = word["topic"] + "-" + re.sub(r"[^a-z0-9]+", "-", plain(word["fr"])).strip("-")
    m = ARTICLE.match(word["fr"])
    word["article"] = m.group(1).strip() if m else ""
    if not word["gender"] and word["article"] in ("le", "la"):
        word["gender"] = "m" if word["article"] == "le" else "f"
    word["blank"] = re.search(r"\{(.+?)\}", word["example"]).group(1)


def _check() -> None:
    """Catch data typos at startup, so a broken word never reaches a drill."""
    topics = {t["id"] for t in TOPICS}
    seen = set()
    for w in WORDS:
        where = f"vocab word « {w['fr']} »"
        assert w["topic"] in topics, f"{where}: unknown topic {w['topic']}"
        assert w["level"] in LEVELS[1:], f"{where}: level must be A2, B1, B2 or C1"
        assert w["example"].count("{") == 1 and w["example"].count("}") == 1, f"{where}: mark the word once with {{ }}"
        assert w["id"] not in seen, f"{where}: duplicate"
        seen.add(w["id"])
        if w["article"] in ("les", "l'"):
            assert w["gender"] in ("m", "f"), f"{where}: give gender='m' or 'f' for l'/les nouns"


for _w in WORDS:
    _finish(_w)
_check()
BY_ID = {w["id"]: w for w in WORDS}
TOPIC_BY_ID = {t["id"]: t for t in TOPICS + [MIXED]}


# ---------- Spaced repetition memory ----------

def _progress_path():
    return memory.SESSIONS_DIR / "vocab" / "progress.json"


def load_progress() -> dict:
    """{word id: {"stage", "due", "last_seen", "seen", "right", "wrong", "last_correct"}}"""
    try:
        data = json.loads(_progress_path().read_text(encoding="utf-8"))
        return data.get("words", {}) if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def _save_progress(words: dict) -> None:
    path = _progress_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps({"words": words}, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(path)


def reset_progress() -> None:
    _progress_path().unlink(missing_ok=True)


def _due(rec: dict) -> date:
    try:
        return date.fromisoformat(rec["due"])
    except (KeyError, ValueError, TypeError):
        return date.min


def record(results: list[dict], today: date | None = None) -> dict:
    """Update the schedule after a drill. `results` = [{"id", "correct"}].
    Right: the next review moves one step further (1, 3, 7, 16, 35 days). Missed: back tomorrow."""
    today = today or date.today()
    words = load_progress()
    out = {}
    for r in results:
        if r["id"] not in BY_ID:
            continue
        rec = words.get(r["id"]) or {"stage": -1, "seen": 0, "right": 0, "wrong": 0}
        if r["correct"]:
            rec["stage"] = min(rec.get("stage", -1) + 1, len(INTERVALS) - 1)
            rec["right"] = rec.get("right", 0) + 1
        else:
            rec["stage"] = 0
            rec["wrong"] = rec.get("wrong", 0) + 1
        days = INTERVALS[rec["stage"]]
        rec.update(seen=rec.get("seen", 0) + 1, last_correct=bool(r["correct"]),
                   last_seen=today.isoformat(), due=(today + timedelta(days=days)).isoformat())
        words[r["id"]] = rec
        out[r["id"]] = {"due": rec["due"], "days": days}
    _save_progress(words)
    return out


def summary(today: date | None = None) -> dict:
    """For the home page: words learned (right at their latest review) and words due today."""
    today = today or date.today()
    words = {k: v for k, v in load_progress().items() if k in BY_ID}
    return {
        "learned": sum(1 for r in words.values() if r.get("last_correct")),
        "due": sum(1 for r in words.values() if _due(r) <= today),
        "seen": len(words),
    }


# ---------- Building a drill ----------

def _level_index(level: str) -> int:
    return max(LEVELS.index(level), 1) if level in LEVELS else 1  # A1 learners start with A2 words


def topics(level: str, today: date | None = None) -> list[dict]:
    """Topic cards: how many words there are, how many are due and how many are new."""
    today = today or date.today()
    progress = load_progress()
    top = _level_index(level) + 1  # your level and one above

    def counts(pool):
        due = sum(1 for w in pool if w["id"] in progress and _due(progress[w["id"]]) <= today)
        new = sum(1 for w in pool if w["id"] not in progress and LEVELS.index(w["level"]) <= top)
        return {"words": len(pool), "due": due, "new": new}

    cards = [{**t, **counts([w for w in WORDS if w["topic"] == t["id"]])} for t in TOPICS]
    return [{**MIXED, **counts(WORDS)}] + cards


def pick(topic: str, count: int, level: str, today: date | None = None, rng: random.Random | None = None) -> list[dict]:
    """The words for one drill.

    Order of priority: words due for review (most overdue first), then new words at your
    level with about a quarter from one level above, then lower levels, then words reviewed
    recently (soonest due first). Mixed review draws from every topic.
    """
    today = today or date.today()
    rng = rng or random.Random()
    progress = load_progress()
    pool = WORDS if topic == "mixed" else [w for w in WORDS if w["topic"] == topic]

    due = sorted((w for w in pool if w["id"] in progress and _due(progress[w["id"]]) <= today),
                 key=lambda w: (_due(progress[w["id"]]), progress[w["id"]].get("stage", 0)))
    chosen = due[:count]

    new = [w for w in pool if w["id"] not in progress]
    rng.shuffle(new)
    base = _level_index(level)
    at = lambda i: [w for w in new if LEVELS.index(w["level"]) == i]  # noqa: E731
    room = count - len(chosen)
    above_quota = round(room * ABOVE_SHARE)
    above = at(base + 1)[:above_quota]
    same = at(base)[: room - len(above)]
    fill = [w for i in [base, base + 1] + list(range(base - 1, 0, -1)) + list(range(base + 2, len(LEVELS)))
            for w in at(i) if w not in same and w not in above]
    chosen += same + above
    chosen += fill[: count - len(chosen)]

    if len(chosen) < count:  # everything has been seen: review the words coming back soonest
        later = sorted((w for w in pool if w["id"] in progress and w not in chosen),
                       key=lambda w: _due(progress[w["id"]]))
        chosen += later[: count - len(chosen)]

    rng.shuffle(chosen)
    return [public(w, progress.get(w["id"])) for w in chosen]


def public(word: dict, rec: dict | None = None) -> dict:
    """A word as the drill page needs it, with where it stands in your reviews."""
    return {
        "id": word["id"],
        "topic": word["topic"],
        "level": word["level"],
        "fr": word["fr"],
        "en": word["en"],
        "article": word["article"],
        "gender": word["gender"],
        "accept": word["accept"],
        "example": word["example"],
        "example_en": word["example_en"],
        "blank": word["blank"],
        "new": rec is None,
        "stage": rec.get("stage", 0) if rec else -1,
        "last_correct": rec.get("last_correct") if rec else None,
    }


def core(fr: str) -> str:
    """The word without its article or reflexive pronoun: "le loyer" → "loyer", "s'adapter" → "adapter"."""
    return re.sub(r"^(le |la |les |l'|se |s'|être )", "", plain(fr))


def ai_example(word: dict, sentence: str, answer: str) -> str | None:
    """Claire's fresh sentence in the {blank} format, or None if it doesn't really use the word."""
    sentence, answer = sentence.strip(), answer.strip()
    if not sentence or not answer or "{" in sentence or len(sentence) > 200:
        return None
    # Keep an article out of the blank ("le bail" → "bail"), as in the built-in sentences.
    art = re.match(r"(?i)^(le |la |les |l'|l’|un |une |des |du )(.+)$", answer)
    if art and plain(art.group(2))[:4] == core(word["fr"])[:4]:
        answer = art.group(2)
    end = "" if answer[-1] in "'’" else r"(?!\w)"  # « qu'il »: the next word follows the apostrophe
    m = re.search(r"(?<!\w)" + re.escape(answer) + end, sentence, re.IGNORECASE)
    if not m:
        return None
    c = core(word["fr"])
    tokens = re.split(r"[\s']+", plain(answer))  # "le bail", "s'est blessé": look at each word
    if not (any(t[:4] == c[:4] for t in tokens if t) or plain(answer) == plain(word["blank"])):
        return None  # a different word: keep the checked built-in sentence
    return sentence[: m.start()] + "{" + m.group(0) + "}" + sentence[m.end():]


def note(topic_title: str, words: list[dict]) -> str:
    """The line shown under the drill in Recent sessions (no AI)."""
    right = [w for w in words if w["correct"]]
    missed = [w["fr"] for w in words if not w["correct"]]
    text = f"Vocabulary drill ({topic_title}): {len(right)}/{len(words)} words right."
    if missed:
        text += " To review: " + ", ".join(missed[:5]) + ("…" if len(missed) > 5 else ".")
    return text
