export const ERAS = [
  'Founding era',
  'Jacksonian era',
  'Civil War era',
  'Gilded Age',
  'Progressive era & twenties',
  'Depression, war & postwar',
  'Late Cold War',
  'Modern era',
] as const;

export interface PresidentEntry {
  key: string;
  name: string;
  /** Accepted typed answers besides `name`. Never a bare shared surname. */
  aliases: string[];
  numbers: number[];
  startYears: number[];
  party: string;
  partyAliases?: string[];
  era: (typeof ERAS)[number];
  /** English Wikipedia article whose lead image is the portrait. */
  wikipedia: string;
  /** Overrides the lead image with a specific Commons file (e.g. when the lead image is not public domain). */
  commonsFile?: string;
}

const DR = 'Democratic-Republican';
const D = 'Democratic';
const R = 'Republican';

export const PRESIDENTS: PresidentEntry[] = [
  { key: 'washington', name: 'George Washington', aliases: ['Washington'], numbers: [1], startYears: [1789], party: 'No party', era: 'Founding era', wikipedia: 'George_Washington' },
  { key: 'j-adams', name: 'John Adams', aliases: [], numbers: [2], startYears: [1797], party: 'Federalist', era: 'Founding era', wikipedia: 'John_Adams' },
  { key: 'jefferson', name: 'Thomas Jefferson', aliases: ['Jefferson'], numbers: [3], startYears: [1801], party: DR, era: 'Founding era', wikipedia: 'Thomas_Jefferson' },
  { key: 'madison', name: 'James Madison', aliases: ['Madison'], numbers: [4], startYears: [1809], party: DR, era: 'Founding era', wikipedia: 'James_Madison' },
  { key: 'monroe', name: 'James Monroe', aliases: ['Monroe'], numbers: [5], startYears: [1817], party: DR, era: 'Founding era', wikipedia: 'James_Monroe' },
  { key: 'jq-adams', name: 'John Quincy Adams', aliases: ['J. Q. Adams', 'JQA', 'Quincy Adams'], numbers: [6], startYears: [1825], party: DR, partyAliases: ['National Republican'], era: 'Founding era', wikipedia: 'John_Quincy_Adams' },
  { key: 'jackson', name: 'Andrew Jackson', aliases: ['Jackson'], numbers: [7], startYears: [1829], party: D, era: 'Jacksonian era', wikipedia: 'Andrew_Jackson' },
  { key: 'van-buren', name: 'Martin Van Buren', aliases: ['Van Buren'], numbers: [8], startYears: [1837], party: D, era: 'Jacksonian era', wikipedia: 'Martin_Van_Buren' },
  { key: 'wh-harrison', name: 'William Henry Harrison', aliases: ['W. H. Harrison', 'William Harrison'], numbers: [9], startYears: [1841], party: 'Whig', era: 'Jacksonian era', wikipedia: 'William_Henry_Harrison' },
  { key: 'tyler', name: 'John Tyler', aliases: ['Tyler'], numbers: [10], startYears: [1841], party: 'Whig', era: 'Jacksonian era', wikipedia: 'John_Tyler' },
  { key: 'polk', name: 'James K. Polk', aliases: ['Polk', 'James Polk'], numbers: [11], startYears: [1845], party: D, era: 'Jacksonian era', wikipedia: 'James_K._Polk' },
  { key: 'taylor', name: 'Zachary Taylor', aliases: ['Taylor'], numbers: [12], startYears: [1849], party: 'Whig', era: 'Jacksonian era', wikipedia: 'Zachary_Taylor' },
  { key: 'fillmore', name: 'Millard Fillmore', aliases: ['Fillmore'], numbers: [13], startYears: [1850], party: 'Whig', era: 'Civil War era', wikipedia: 'Millard_Fillmore' },
  { key: 'pierce', name: 'Franklin Pierce', aliases: ['Pierce'], numbers: [14], startYears: [1853], party: D, era: 'Civil War era', wikipedia: 'Franklin_Pierce' },
  { key: 'buchanan', name: 'James Buchanan', aliases: ['Buchanan'], numbers: [15], startYears: [1857], party: D, era: 'Civil War era', wikipedia: 'James_Buchanan' },
  { key: 'lincoln', name: 'Abraham Lincoln', aliases: ['Lincoln'], numbers: [16], startYears: [1861], party: R, partyAliases: ['National Union'], era: 'Civil War era', wikipedia: 'Abraham_Lincoln' },
  { key: 'a-johnson', name: 'Andrew Johnson', aliases: [], numbers: [17], startYears: [1865], party: 'National Union', partyAliases: [D], era: 'Civil War era', wikipedia: 'Andrew_Johnson' },
  { key: 'grant', name: 'Ulysses S. Grant', aliases: ['Grant', 'Ulysses Grant'], numbers: [18], startYears: [1869], party: R, era: 'Civil War era', wikipedia: 'Ulysses_S._Grant' },
  { key: 'hayes', name: 'Rutherford B. Hayes', aliases: ['Hayes', 'Rutherford Hayes'], numbers: [19], startYears: [1877], party: R, era: 'Gilded Age', wikipedia: 'Rutherford_B._Hayes' },
  { key: 'garfield', name: 'James A. Garfield', aliases: ['Garfield', 'James Garfield'], numbers: [20], startYears: [1881], party: R, era: 'Gilded Age', wikipedia: 'James_A._Garfield' },
  { key: 'arthur', name: 'Chester A. Arthur', aliases: ['Arthur', 'Chester Arthur'], numbers: [21], startYears: [1881], party: R, era: 'Gilded Age', wikipedia: 'Chester_A._Arthur' },
  { key: 'cleveland', name: 'Grover Cleveland', aliases: ['Cleveland'], numbers: [22, 24], startYears: [1885, 1893], party: D, era: 'Gilded Age', wikipedia: 'Grover_Cleveland' },
  { key: 'b-harrison', name: 'Benjamin Harrison', aliases: ['Ben Harrison'], numbers: [23], startYears: [1889], party: R, era: 'Gilded Age', wikipedia: 'Benjamin_Harrison' },
  { key: 'mckinley', name: 'William McKinley', aliases: ['McKinley'], numbers: [25], startYears: [1897], party: R, era: 'Gilded Age', wikipedia: 'William_McKinley' },
  { key: 't-roosevelt', name: 'Theodore Roosevelt', aliases: ['Teddy Roosevelt', 'TR'], numbers: [26], startYears: [1901], party: R, era: 'Progressive era & twenties', wikipedia: 'Theodore_Roosevelt' },
  { key: 'taft', name: 'William Howard Taft', aliases: ['Taft'], numbers: [27], startYears: [1909], party: R, era: 'Progressive era & twenties', wikipedia: 'William_Howard_Taft' },
  { key: 'wilson', name: 'Woodrow Wilson', aliases: ['Wilson'], numbers: [28], startYears: [1913], party: D, era: 'Progressive era & twenties', wikipedia: 'Woodrow_Wilson' },
  { key: 'harding', name: 'Warren G. Harding', aliases: ['Harding', 'Warren Harding'], numbers: [29], startYears: [1921], party: R, era: 'Progressive era & twenties', wikipedia: 'Warren_G._Harding' },
  { key: 'coolidge', name: 'Calvin Coolidge', aliases: ['Coolidge'], numbers: [30], startYears: [1923], party: R, era: 'Progressive era & twenties', wikipedia: 'Calvin_Coolidge' },
  { key: 'hoover', name: 'Herbert Hoover', aliases: ['Hoover'], numbers: [31], startYears: [1929], party: R, era: 'Progressive era & twenties', wikipedia: 'Herbert_Hoover' },
  { key: 'f-roosevelt', name: 'Franklin D. Roosevelt', aliases: ['Franklin Roosevelt', 'FDR'], numbers: [32], startYears: [1933], party: D, era: 'Depression, war & postwar', wikipedia: 'Franklin_D._Roosevelt', commonsFile: 'FDR_in_1933.jpg' },
  { key: 'truman', name: 'Harry S. Truman', aliases: ['Truman', 'Harry Truman'], numbers: [33], startYears: [1945], party: D, era: 'Depression, war & postwar', wikipedia: 'Harry_S._Truman' },
  { key: 'eisenhower', name: 'Dwight D. Eisenhower', aliases: ['Eisenhower', 'Dwight Eisenhower'], numbers: [34], startYears: [1953], party: R, era: 'Depression, war & postwar', wikipedia: 'Dwight_D._Eisenhower' },
  { key: 'kennedy', name: 'John F. Kennedy', aliases: ['Kennedy', 'John Kennedy', 'JFK'], numbers: [35], startYears: [1961], party: D, era: 'Depression, war & postwar', wikipedia: 'John_F._Kennedy' },
  { key: 'l-johnson', name: 'Lyndon B. Johnson', aliases: ['Lyndon Johnson', 'LBJ'], numbers: [36], startYears: [1963], party: D, era: 'Depression, war & postwar', wikipedia: 'Lyndon_B._Johnson' },
  { key: 'nixon', name: 'Richard Nixon', aliases: ['Nixon'], numbers: [37], startYears: [1969], party: R, era: 'Late Cold War', wikipedia: 'Richard_Nixon' },
  { key: 'ford', name: 'Gerald Ford', aliases: ['Ford'], numbers: [38], startYears: [1974], party: R, era: 'Late Cold War', wikipedia: 'Gerald_Ford' },
  { key: 'carter', name: 'Jimmy Carter', aliases: ['Carter'], numbers: [39], startYears: [1977], party: D, era: 'Late Cold War', wikipedia: 'Jimmy_Carter' },
  { key: 'reagan', name: 'Ronald Reagan', aliases: ['Reagan'], numbers: [40], startYears: [1981], party: R, era: 'Late Cold War', wikipedia: 'Ronald_Reagan' },
  { key: 'hw-bush', name: 'George H. W. Bush', aliases: ['H. W. Bush', 'Bush 41'], numbers: [41], startYears: [1989], party: R, era: 'Late Cold War', wikipedia: 'George_H._W._Bush' },
  { key: 'clinton', name: 'Bill Clinton', aliases: ['Clinton'], numbers: [42], startYears: [1993], party: D, era: 'Modern era', wikipedia: 'Bill_Clinton' },
  { key: 'gw-bush', name: 'George W. Bush', aliases: ['G. W. Bush', 'Bush 43'], numbers: [43], startYears: [2001], party: R, era: 'Modern era', wikipedia: 'George_W._Bush' },
  { key: 'obama', name: 'Barack Obama', aliases: ['Obama'], numbers: [44], startYears: [2009], party: D, era: 'Modern era', wikipedia: 'Barack_Obama' },
  { key: 'trump', name: 'Donald Trump', aliases: ['Trump'], numbers: [45, 47], startYears: [2017, 2025], party: R, era: 'Modern era', wikipedia: 'Donald_Trump' },
  { key: 'biden', name: 'Joe Biden', aliases: ['Biden'], numbers: [46], startYears: [2021], party: D, era: 'Modern era', wikipedia: 'Joe_Biden' },
];

/** Easily confused faces (seed confusions), each pair once. Era neighbours are added automatically. */
export const FACE_LOOKALIKE_PAIRS: [string, string][] = [
  ['arthur', 'hayes'], ['pierce', 'fillmore'], ['harding', 'coolidge'], ['b-harrison', 'hayes'],
  ['madison', 'monroe'], ['taft', 'mckinley'], ['hw-bush', 'gw-bush'], ['wh-harrison', 'tyler'],
];

/** Pairs never put in the same put-in-order question: no single chronological order exists. */
export const SHARED_SPAN_PAIRS: [string, string][] = [
  ['cleveland', 'b-harrison'],
  ['trump', 'biden'],
];
