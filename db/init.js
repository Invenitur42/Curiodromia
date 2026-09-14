const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const dataDir = process.env.DATA_DIR || __dirname;
try {
  fs.mkdirSync(dataDir, { recursive: true });
} catch (_) {}

const DB_PATH = path.join(dataDir, "curiodromia.sqlite");
const SCHEMA_PATH = path.join(__dirname, "schema.sql");

let db;
try {
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
} catch (err) {
  console.error("Failed to open SQLite database at", DB_PATH, err);
  throw err;
}

const CATEGORIES = [
  ["web-dev", "Web Development"],
  ["mobile-dev", "Mobile Development"],
  ["game-dev", "Game Development"],
  ["data-science", "Data Science"],
  ["machine-learning", "Machine Learning & AI"],
  ["cybersecurity", "Cybersecurity"],
  ["devops", "DevOps & Cloud"],
  ["databases", "Databases"],
  ["programming", "Programming Fundamentals"],
  ["hardware", "Hardware & Embedded"],
  ["design", "Design & UX"],
  ["graphic-design", "Graphic Design"],
  ["photography", "Photography"],
  ["video-editing", "Video Editing"],
  ["animation", "Animation & Motion"],
  ["music-production", "Music Production"],
  ["writing", "Writing & Storytelling"],
  ["drawing", "Drawing & Illustration"],
  ["business", "Business & Startups"],
  ["marketing", "Marketing"],
  ["finance", "Personal Finance"],
  ["investing", "Investing"],
  ["sales", "Sales"],
  ["product-management", "Product Management"],
  ["languages", "World Languages"],
  ["english", "English"],
  ["public-speaking", "Public Speaking"],
  ["mathematics", "Mathematics"],
  ["physics", "Physics"],
  ["chemistry", "Chemistry"],
  ["biology", "Biology"],
  ["engineering", "Engineering"],
  ["astronomy", "Astronomy & Space"],
  ["cooking", "Cooking & Baking"],
  ["gardening", "Gardening"],
  ["woodworking", "Woodworking"],
  ["home-repair", "Home Repair & DIY"],
  ["automotive", "Automotive"],
  ["sewing", "Sewing & Textiles"],
  ["fitness", "Fitness & Strength"],
  ["yoga", "Yoga & Mobility"],
  ["nutrition", "Nutrition"],
  ["mental-health", "Mental Health"],
  ["first-aid", "First Aid & Safety"],
  ["career", "Career Growth"],
  ["productivity", "Productivity"],
  ["philosophy", "Philosophy"],
  ["psychology", "Psychology"],
  ["history", "History"],
  ["law", "Law & Civics"],
  ["music-theory", "Music Theory & Instruments"],
  ["dance", "Dance"],
  ["theater", "Theater & Acting"],
  ["film", "Film Studies"],
  ["chess", "Chess & Strategy Games"],
  ["board-games", "Board Games"],
  ["crafts", "Crafts & Making"],
  ["general", "General Knowledge"],
];

const RESOURCES = {
  "web-dev": [
    ["MDN Web Docs", "Definitive reference for HTML, CSS, and JavaScript.", "https://developer.mozilla.org"],
    ["freeCodeCamp", "Free project-based full-stack web curriculum.", "https://www.freecodecamp.org"],
    ["The Odin Project", "Open-source full-stack web development path.", "https://www.theodinproject.com"],
    ["CSS-Tricks", "Practical CSS techniques and guides.", "https://css-tricks.com"],
  ],
  "mobile-dev": [
    ["Android Developers", "Official Android training and docs.", "https://developer.android.com/courses"],
    ["Apple Developer — Swift", "Learn Swift and iOS development.", "https://developer.apple.com/swift/"],
    ["React Native Docs", "Build native apps with React.", "https://reactnative.dev/docs/getting-started"],
    ["Flutter Codelabs", "Google’s hands-on Flutter tutorials.", "https://docs.flutter.dev/codelabs"],
  ],
  "game-dev": [
    ["Unity Learn", "Free interactive Unity tutorials.", "https://learn.unity.com"],
    ["Godot Docs", "Open-source engine documentation and tutorials.", "https://docs.godotengine.org"],
    ["GDQuest", "Free Godot courses and best practices.", "https://www.gdquest.com"],
    ["OpenGameArt", "Free game art and audio assets.", "https://opengameart.org"],
  ],
  "data-science": [
    ["Kaggle Learn", "Short hands-on courses in Python, ML, and viz.", "https://www.kaggle.com/learn"],
    ["Google Data Analytics (Coursera audit)", "Structured data analytics path you can audit free.", "https://www.coursera.org/professional-certificates/google-data-analytics"],
    ["DataCamp Free Intro", "Interactive intros to data skills.", "https://www.datacamp.com"],
    ["StatQuest (YouTube)", "Statistics explained simply and visually.", "https://www.youtube.com/@statquest"],
  ],
  "machine-learning": [
    ["fast.ai", "Practical deep learning for coders.", "https://www.fast.ai"],
    ["Google Machine Learning Crash Course", "Free ML fundamentals from Google.", "https://developers.google.com/machine-learning/crash-course"],
    ["Hugging Face Course", "Free course on transformers and NLP.", "https://huggingface.co/learn"],
    ["Elements of AI", "Accessible intro to AI concepts.", "https://www.elementsofai.com"],
  ],
  cybersecurity: [
    ["TryHackMe", "Guided cybersecurity labs and rooms.", "https://tryhackme.com"],
    ["OWASP Top Ten", "Most critical web application security risks.", "https://owasp.org/www-project-top-ten/"],
    ["Cybrary Free", "Free cybersecurity courses and paths.", "https://www.cybrary.it"],
    ["PortSwigger Web Security Academy", "Free web security training labs.", "https://portswigger.net/web-security"],
  ],
  devops: [
    ["Kubernetes Docs", "Official Kubernetes documentation.", "https://kubernetes.io/docs/home/"],
    ["Docker Getting Started", "Hands-on Docker introduction.", "https://docs.docker.com/get-started/"],
    ["AWS Free Tier Workshops", "Hands-on cloud labs.", "https://aws.amazon.com/getting-started/"],
    ["DevOps Roadmap", "Structured overview of DevOps skills.", "https://roadmap.sh/devops"],
  ],
  databases: [
    ["SQLBolt", "Interactive SQL lessons.", "https://sqlbolt.com"],
    ["PostgreSQL Tutorial", "Free PostgreSQL tutorials.", "https://www.postgresqltutorial.com"],
    ["MongoDB University", "Free MongoDB courses.", "https://learn.mongodb.com"],
    ["DB Fiddle", "Practice SQL in the browser.", "https://www.db-fiddle.com"],
  ],
  programming: [
    ["CS50 (Harvard)", "Legendary intro computer science course.", "https://cs50.harvard.edu"],
    ["Exercism", "Practice coding with mentorship in many languages.", "https://exercism.org"],
    ["Python.org Tutorial", "Official Python tutorial.", "https://docs.python.org/3/tutorial/"],
    ["Rust Book", "Official free Rust language book.", "https://doc.rust-lang.org/book/"],
  ],
  hardware: [
    ["Arduino Project Hub", "Projects and guides for Arduino.", "https://projecthub.arduino.cc"],
    ["Raspberry Pi Docs", "Official Pi documentation and projects.", "https://www.raspberrypi.com/documentation/"],
    ["SparkFun Learn", "Electronics tutorials and kits guides.", "https://learn.sparkfun.com"],
    ["All About Circuits", "Free textbooks on electrical engineering.", "https://www.allaboutcircuits.com/textbook/"],
  ],
  design: [
    ["Refactoring UI", "Practical visual design tips.", "https://www.refactoringui.com"],
    ["Laws of UX", "Psychology principles behind good design.", "https://lawsofux.com"],
    ["Figma Learn", "Official Figma tutorials.", "https://help.figma.com/hc/en-us/categories/360002032553"],
    ["Interaction Design Foundation Free", "Free UX articles and intros.", "https://www.interaction-design.org"],
  ],
  "graphic-design": [
    ["Canva Design School", "Free design courses and templates.", "https://www.canva.com/designschool/"],
    ["GIMP Tutorials", "Free image editing with GIMP.", "https://www.gimp.org/tutorials/"],
    ["Inkscape Manual", "Vector graphics with free software.", "https://inkscape.org/learn/"],
    ["Typewolf", "Typography inspiration and font pairing.", "https://www.typewolf.com"],
  ],
  photography: [
    ["Cambridge in Colour", "Excellent free photography tutorials.", "https://www.cambridgeincolour.com"],
    ["Digital Photography School", "Practical photography tips.", "https://digital-photography-school.com"],
    ["Photography Life", "In-depth gear and technique articles.", "https://photographylife.com"],
    ["Phlearn Free", "Photoshop and photography tutorials.", "https://phlearn.com"],
  ],
  "video-editing": [
    ["DaVinci Resolve Training", "Free professional editor + free training.", "https://www.blackmagicdesign.com/products/davinciresolve/training"],
    ["Premiere Rush / Adobe Learn", "Adobe free learning resources.", "https://helpx.adobe.com/premiere-pro/tutorials.html"],
    ["CapCut Learn", "Mobile and desktop editing basics.", "https://www.capcut.com"],
    ["Film Riot (YouTube)", "Filmmaking techniques and effects.", "https://www.youtube.com/@FilmRiot"],
  ],
  animation: [
    ["Blender Cloud Free Lessons", "3D animation with free Blender.", "https://www.blender.org/support/tutorials/"],
    ["Animator Island", "Animation principles and exercises.", "https://www.animatorisland.com"],
    ["Synfig Tutorials", "Free 2D animation software guides.", "https://www.synfig.org/cms/en/documentation/"],
    ["Alan Becker (YouTube)", "Animator vs Animation and tutorials.", "https://www.youtube.com/@AlanBecker"],
  ],
  "music-production": [
    ["LMMS", "Free digital audio workstation.", "https://lmms.io"],
    ["Audacity Manual", "Free audio editing software guides.", "https://manual.audacityteam.org"],
    ["Recording Revolution", "Free mixing and recording tips.", "https://www.recordingrevolution.com"],
    ["Bedroom Producers Blog", "Free samples, plugins, and tutorials.", "https://bedroomproducersblog.com"],
  ],
  writing: [
    ["Purdue OWL", "Writing and citation reference.", "https://owl.purdue.edu"],
    ["NaNoWriMo Resources", "Tools and pep for long-form writing.", "https://nanowrimo.org"],
    ["Hemingway Editor", "Clarity-focused writing feedback.", "https://hemingwayapp.com"],
    ["Project Gutenberg", "Free classic literature to study.", "https://www.gutenberg.org"],
  ],
  drawing: [
    ["Drawabox", "Free structured drawing fundamentals.", "https://drawabox.com"],
    ["Proko", "Figure drawing and anatomy lessons.", "https://www.proko.com"],
    ["Ctrl+Paint", "Digital painting fundamentals (free library).", "https://ctrlpaint.com"],
    ["Line of Action", "Free figure and animal drawing references.", "https://line-of-action.com"],
  ],
  business: [
    ["Y Combinator Startup School", "Free startup lessons.", "https://www.startupschool.org"],
    ["Indie Hackers", "Bootstrapped founder stories and numbers.", "https://www.indiehackers.com"],
    ["SCORE Mentors", "Free small-business mentoring (US).", "https://www.score.org"],
    ["Lean Canvas", "One-page business model tool.", "https://leanstack.com/lean-canvas"],
  ],
  marketing: [
    ["HubSpot Academy", "Free inbound marketing and CRM courses.", "https://academy.hubspot.com"],
    ["Google Digital Garage", "Free digital marketing fundamentals.", "https://grow.google/intl/en_uk/courses-and-tools/"],
    ["Backlinko Guides", "SEO guides and frameworks.", "https://backlinko.com"],
    ["CXL Blog", "Conversion and growth marketing articles.", "https://cxl.com/blog/"],
  ],
  finance: [
    ["Khan Academy Personal Finance", "Budgeting, credit, and investing basics.", "https://www.khanacademy.org/college-careers-more/personal-finance"],
    ["Investopedia", "Clear definitions and tutorials.", "https://www.investopedia.com"],
    ["Mr. Money Mustache", "Frugality and financial independence ideas.", "https://www.mrmoneymustache.com"],
    ["Consumer Financial Protection Bureau", "Unbiased money tools and guides.", "https://www.consumerfinance.gov"],
  ],
  investing: [
    ["Bogleheads Wiki", "Evidence-based investing principles.", "https://www.bogleheads.org/wiki/Main_Page"],
    ["SEC Investor Education", "Official investor education resources.", "https://www.investor.gov"],
    ["Morningstar Classroom", "Free investing education articles.", "https://www.morningstar.com"],
    ["Khan Academy Investing", "Stocks, bonds, and portfolios explained.", "https://www.khanacademy.org/economics-finance-domain/core-finance"],
  ],
  sales: [
    ["HubSpot Sales Training", "Free sales courses.", "https://academy.hubspot.com/courses/sales"],
    ["Gong Labs Blog", "Research-backed sales insights.", "https://www.gong.io/resources/"],
    ["SPICED / Winning by Design", "Modern sales methodology resources.", "https://winningbydesign.com/resources/"],
  ],
  "product-management": [
    ["Product School Resources", "Product management articles and templates.", "https://productschool.com/blog"],
    ["SVPG Essays", "Marty Cagan’s product essays.", "https://www.svpg.com/articles/"],
    ["Mind the Product", "Community and free PM content.", "https://www.mindtheproduct.com"],
    ["Reforge Blog", "Growth and product strategy deep-dives.", "https://www.reforge.com/blog"],
  ],
  languages: [
    ["Duolingo", "Bite-sized lessons in dozens of languages.", "https://www.duolingo.com"],
    ["Language Transfer", "Free audio courses focused on thinking in the language.", "https://www.languagetransfer.org"],
    ["Anki", "Spaced-repetition flashcards (free desktop).", "https://apps.ankiweb.net"],
    ["Tandem", "Practice with native speakers.", "https://www.tandem.net"],
  ],
  english: [
    ["BBC Learning English", "Free lessons for all levels.", "https://www.bbc.co.uk/learningenglish"],
    ["British Council English", "Skills practice and grammar.", "https://learnenglish.britishcouncil.org"],
    ["EnglishClub", "Grammar, vocabulary, and quizzes.", "https://www.englishclub.com"],
    ["VOA Learning English", "News and lessons for learners.", "https://learningenglish.voanews.com"],
  ],
  "public-speaking": [
    ["Toastmasters Resources", "Public speaking practice frameworks.", "https://www.toastmasters.org"],
    ["TED Talks", "Study great talks as models.", "https://www.ted.com/talks"],
    ["Speak Out Loud", "Free speech and rhetoric resources.", "https://www.speakoutloud.net"],
  ],
  mathematics: [
    ["3Blue1Brown", "Visual, intuition-first math.", "https://www.youtube.com/@3blue1brown"],
    ["Khan Academy Math", "Arithmetic through calculus.", "https://www.khanacademy.org/math"],
    ["Paul’s Online Math Notes", "Clear calculus and algebra notes.", "https://tutorial.math.lamar.edu"],
    ["Art of Problem Solving", "Problem-solving for competition math.", "https://artofproblemsolving.com"],
  ],
  physics: [
    ["MIT OpenCourseWare Physics", "Full university physics courses.", "https://ocw.mit.edu/courses/physics/"],
    ["Physics Classroom", "High-school physics tutorials.", "https://www.physicsclassroom.com"],
    ["MinutePhysics", "Short conceptual physics videos.", "https://www.youtube.com/@minutephysics"],
    ["HyperPhysics", "Concept maps of physics topics.", "http://hyperphysics.phy-astr.gsu.edu"],
  ],
  chemistry: [
    ["Khan Academy Chemistry", "General and organic chemistry.", "https://www.khanacademy.org/science/chemistry"],
    ["ChemCollective", "Virtual labs and tutorials.", "https://chemcollective.org"],
    ["Master Organic Chemistry", "Organic chemistry study resources.", "https://www.masterorganicchemistry.com"],
  ],
  biology: [
    ["Khan Academy Biology", "From cells to ecosystems.", "https://www.khanacademy.org/science/biology"],
    ["Crash Course Biology", "Engaging video series.", "https://thecrashcourse.com/topic/biology/"],
    ["HHMI BioInteractive", "Free biology videos and activities.", "https://www.biointeractive.org"],
  ],
  engineering: [
    ["MIT OpenCourseWare Engineering", "Engineering course materials.", "https://ocw.mit.edu/courses/find-by-topic/#cat=engineering"],
    ["Coursera Engineering (audit)", "Audit university engineering courses free.", "https://www.coursera.org/browse/physical-science-and-engineering"],
    ["Engineer4Free", "Free engineering tutorials.", "https://www.engineer4free.com"],
  ],
  astronomy: [
    ["NASA Space Place", "Accessible space science.", "https://spaceplace.nasa.gov"],
    ["Crash Course Astronomy", "Survey of astronomy topics.", "https://thecrashcourse.com/topic/astronomy/"],
    ["Stellarium", "Free planetarium software.", "https://stellarium.org"],
    ["Astronomy Picture of the Day", "Daily cosmic images with explanations.", "https://apod.nasa.gov"],
  ],
  cooking: [
    ["Serious Eats", "Technique-driven recipes and food science.", "https://www.seriouseats.com"],
    ["BBC Good Food", "Reliable recipes for all levels.", "https://www.bbcgoodfood.com"],
    ["America’s Test Kitchen YouTube", "Methodical cooking demonstrations.", "https://www.youtube.com/@AmericasTestKitchen"],
    ["Budget Bytes", "Affordable, practical cooking.", "https://www.budgetbytes.com"],
  ],
  gardening: [
    ["RHS Grow Your Own", "Royal Horticultural Society growing guides.", "https://www.rhs.org.uk/vegetables/grow-your-own"],
    ["University Extension Services", "Science-based gardening advice (search your region).", "https://extension.org"],
    ["Gardeners’ World", "Practical garden how-tos.", "https://www.gardenersworld.com"],
  ],
  woodworking: [
    ["Woodworking for Mere Mortals", "Beginner-friendly projects and videos.", "https://woodworkingformeremortals.com"],
    ["Paul Sellers", "Hand-tool woodworking instruction.", "https://paulsellers.com"],
    ["Fine Woodworking Free", "Selected free articles and tips.", "https://www.finewoodworking.com"],
  ],
  "home-repair": [
    ["This Old House", "Home repair and improvement guides.", "https://www.thisoldhouse.com"],
    ["Family Handyman", "DIY fixes and projects.", "https://www.familyhandyman.com"],
    ["WikiHow Home & Garden", "Step-by-step DIY articles.", "https://www.wikihow.com/Category:Home-and-Garden"],
  ],
  automotive: [
    ["Scotty Kilmer (YouTube)", "Practical car repair videos.", "https://www.youtube.com/@scottykilmer"],
    ["ChrisFix (YouTube)", "DIY auto repair tutorials.", "https://www.youtube.com/@ChrisFix"],
    ["Haynes Free Advice", "Repair tips and maintenance guides.", "https://haynes.com"],
  ],
  sewing: [
    ["Sewing.com Free Patterns", "Beginner sewing patterns and guides.", "https://www.sewing.com"],
    ["Mood Sewciety", "Free sewing patterns and tutorials.", "https://www.moodfabrics.com/blog"],
    ["Threads Monthly", "Sewing techniques and projects.", "https://threadsmonthly.com"],
  ],
  fitness: [
    ["Nike Training Club", "Free guided workouts.", "https://www.nike.com/ntc-app"],
    ["Fitness Blender", "Free full workout videos.", "https://www.fitnessblender.com"],
    ["StrongLifts 5x5", "Simple strength training program.", "https://stronglifts.com/5x5/"],
    ["Reddit r/bodyweightfitness Wiki", "Recommended bodyweight routines.", "https://www.reddit.com/r/bodyweightfitness/wiki/kb/recommended_routine/"],
  ],
  yoga: [
    ["Yoga with Adriene", "Free yoga practices for all levels.", "https://www.youtube.com/@yogawithadriene"],
    ["Down Dog App Free Modes", "Customizable yoga (free options).", "https://www.downdogapp.com"],
    ["DoYogaWithMe", "Free and donation-based classes.", "https://www.doyogawithme.com"],
  ],
  nutrition: [
    ["Examine.com", "Evidence-based nutrition summaries.", "https://examine.com"],
    ["Harvard Nutrition Source", "Science-based nutrition guidance.", "https://www.hsph.harvard.edu/nutritionsource/"],
    ["USDA MyPlate", "Practical balanced-eating guidelines.", "https://www.myplate.gov"],
  ],
  "mental-health": [
    ["Mindful.org", "Mindfulness guides and practices.", "https://www.mindful.org"],
    ["WHO Mental Health", "Global mental health information.", "https://www.who.int/health-topics/mental-health"],
    ["Therapist Aid Worksheets", "Free psychoeducation worksheets.", "https://www.therapistaid.com"],
    ["7 Cups", "Free emotional support chat (community).", "https://www.7cups.com"],
  ],
  "first-aid": [
    ["Red Cross First Aid Apps", "Official first-aid guidance.", "https://www.redcross.org/get-help/how-to-prepare-for-emergencies/mobile-apps.html"],
    ["St John Ambulance First Aid", "Advice and tips.", "https://www.sja.org.uk/get-advice/"],
    ["CDC Emergency Preparedness", "Preparedness and safety resources.", "https://www.cdc.gov/emergency/index.html"],
  ],
  career: [
    ["Ask a Manager", "Workplace advice.", "https://www.askamanager.org"],
    ["Levels.fyi", "Compensation data for tech roles.", "https://www.levels.fyi"],
    ["LeetCode", "Technical interview practice.", "https://leetcode.com"],
  ],
  productivity: [
    ["Todoist Guides", "Getting Things Done style productivity.", "https://www.todoist.com/productivity-methods"],
    ["Cal Newport essays", "Deep work and focus ideas.", "https://calnewport.com/blog/"],
    ["Notion Templates Gallery", "Free organization templates.", "https://www.notion.so/templates"],
  ],
  philosophy: [
    ["Stanford Encyclopedia of Philosophy", "Scholarly free philosophy reference.", "https://plato.stanford.edu"],
    ["Philosophy Bites", "Short interviews with philosophers.", "https://philosophybites.com"],
    ["Crash Course Philosophy", "Survey video series.", "https://thecrashcourse.com/topic/philosophy/"],
  ],
  psychology: [
    ["Simply Psychology", "Clear psychology topic summaries.", "https://www.simplypsychology.org"],
    ["APA Psychology Topics", "American Psychological Association overviews.", "https://www.apa.org/topics"],
    ["Crash Course Psychology", "Introductory video series.", "https://thecrashcourse.com/topic/psychology/"],
  ],
  history: [
    ["Crash Course History", "World and US history series.", "https://thecrashcourse.com"],
    ["BBC History", "Articles and documentaries.", "https://www.bbc.co.uk/history"],
    ["Internet History Sourcebooks", "Primary historical texts.", "https://sourcebooks.fordham.edu"],
  ],
  law: [
    ["Cornell LII", "Free legal information institute.", "https://www.law.cornell.edu"],
    ["Khan Academy US Government", "Civics and government basics.", "https://www.khanacademy.org/humanities/us-government-and-civics"],
    ["iCivics", "Interactive civics education.", "https://www.icivics.org"],
  ],
  "music-theory": [
    ["musictheory.net", "Free lessons and exercises.", "https://www.musictheory.net"],
    ["Teoria", "Theory tutorials and ear training.", "https://www.teoria.com"],
    ["JustinGuitar", "Free guitar lessons.", "https://www.justinguitar.com"],
    ["Hoffman Academy", "Free piano lessons for beginners.", "https://www.hoffmanacademy.com"],
  ],
  dance: [
    ["STEEZY", "Online dance classes (free tiers).", "https://www.steezy.co"],
    ["DancePlug Free", "Selected free dance tutorials.", "https://www.danceplug.com"],
  ],
  theater: [
    ["Drama Notebook Free", "Theater games and lesson ideas.", "https://www.dramanotebook.com"],
    ["Backstage Guides", "Acting and audition advice.", "https://www.backstage.com"],
    ["MIT OpenCourseWare Theater", "Theater arts course materials.", "https://ocw.mit.edu/courses/theater-arts/"],
  ],
  film: [
    ["Every Frame a Painting", "Video essays on film craft.", "https://www.youtube.com/@everyframeapainting"],
    ["No Film School", "Filmmaking news and tutorials.", "https://nofilmschool.com"],
    ["StudioBinder Blog", "Production and directing guides.", "https://www.studiobinder.com/blog/"],
  ],
  chess: [
    ["Lichess Learn", "Free interactive chess lessons and puzzles.", "https://lichess.org/learn"],
    ["Chess.com Lessons (free tier)", "Structured chess courses.", "https://www.chess.com/lessons"],
    ["Chessable Free Courses", "Spaced-repetition chess study.", "https://www.chessable.com"],
  ],
  "board-games": [
    ["BoardGameGeek", "Rules, reviews, and community.", "https://boardgamegeek.com"],
    ["Watch It Played", "Clear how-to-play videos.", "https://www.youtube.com/@WatchItPlayed"],
  ],
  crafts: [
    ["Instructables", "Community DIY and craft projects.", "https://www.instructables.com"],
    ["The Spruce Crafts", "Craft tutorials across media.", "https://www.thesprucecrafts.com"],
    ["MakerSpaces Resources", "Making and tinkering ideas.", "https://www.makerspaces.com"],
  ],
  general: [
    ["Wikipedia", "Free encyclopedia — a strong first stop.", "https://www.wikipedia.org"],
    ["Khan Academy", "Free courses across many subjects.", "https://www.khanacademy.org"],
    ["MIT OpenCourseWare", "Free university-level course materials.", "https://ocw.mit.edu"],
    ["Internet Archive", "Books, video, and audio library.", "https://archive.org"],
    ["Coursera Audit Mode", "Audit thousands of courses free.", "https://www.coursera.org"],
  ],
};

function seedCategoriesAndResources() {
  const insertCategory = db.prepare(
    "INSERT OR IGNORE INTO categories (slug, label) VALUES (?, ?)"
  );
  const insertResource = db.prepare(
    `INSERT INTO resources (category, title, description, url)
     SELECT ?, ?, ?, ?
     WHERE NOT EXISTS (
       SELECT 1 FROM resources WHERE category = ? AND title = ?
     )`
  );

  const tx = db.transaction(() => {
    for (const [slug, label] of CATEGORIES) insertCategory.run(slug, label);
    for (const [category, items] of Object.entries(RESOURCES)) {
      for (const [title, description, url] of items) {
        insertResource.run(category, title, description, url, category, title);
      }
    }
  });
  tx();
}

function seedDemoIfEmpty() {
  const userCount = db.prepare("SELECT COUNT(*) as n FROM users").get().n;
  if (userCount > 0) return;

  const demoHash = bcrypt.hashSync("DemoPass123", 10);
  const demoId = db
    .prepare(
      "INSERT INTO users (username, password_hash, mode, learning_category) VALUES (?, ?, 'explore', NULL)"
    )
    .run("demo", demoHash).lastInsertRowid;

  const q1 = db
    .prepare("INSERT INTO questions (user_id, title, body, category) VALUES (?, ?, ?, ?)")
    .run(
      demoId,
      "What's the actual difference between let, const and var?",
      "I understand var is function-scoped, but I keep seeing style guides ban it entirely. What breaks if I just use var everywhere?",
      "web-dev"
    ).lastInsertRowid;
  db.prepare("INSERT INTO answers (question_id, user_id, body) VALUES (?, ?, ?)").run(
    q1,
    demoId,
    "var is hoisted and function-scoped, so it leaks out of if/for blocks and can be re-declared silently. let/const are block-scoped and const prevents reassignment — catching mistakes earlier."
  );
  db.prepare(
    "INSERT INTO votes (target_type, target_id, user_id, value) VALUES ('question', ?, ?, 1)"
  ).run(q1, demoId);

  const q2 = db
    .prepare("INSERT INTO questions (user_id, title, body, category) VALUES (?, ?, ?, ?)")
    .run(
      demoId,
      "How do I know when a dataset needs normalization before modeling?",
      "Every tutorial normalizes features 'just in case'. Is there a rule of thumb for when it actually matters?",
      "data-science"
    ).lastInsertRowid;
  db.prepare(
    "INSERT INTO votes (target_type, target_id, user_id, value) VALUES ('question', ?, ?, 1)"
  ).run(q2, demoId);

  const c1 = db
    .prepare(
      "INSERT INTO classrooms (title, category, creator_id, status) VALUES (?, ?, ?, 'open')"
    )
    .run("Demystifying async JavaScript", "web-dev", demoId).lastInsertRowid;
  db.prepare("INSERT INTO classroom_members (classroom_id, user_id) VALUES (?, ?)").run(c1, demoId);

  console.log("Seeded demo content (user: demo / DemoPass123).");
}

try {
  seedCategoriesAndResources();
  seedDemoIfEmpty();
  const nCat = db.prepare("SELECT COUNT(*) as n FROM categories").get().n;
  const nRes = db.prepare("SELECT COUNT(*) as n FROM resources").get().n;
  console.log(`Categories: ${nCat}, free resources: ${nRes}`);
} catch (err) {
  console.error("Seed failed:", err);
}

function closeDb() {
  try {
    if (db && db.open) db.close();
  } catch (_) {}
}

module.exports = db;
module.exports.closeDb = closeDb;
