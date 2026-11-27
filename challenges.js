// Catálogo estático de ejercicios. Cada uno tiene instrucciones, la función a
// implementar por lenguaje, código inicial y casos de prueba { args, expected }.
// Los casos con `hidden: true` nunca se envían al candidato: solo el admin los ve
// y los ejecuta. Para agregar un ejercicio, copia uno y ajústalo (y agrega su
// traducción al inglés en EN, al final del archivo).

const py = (name, params, ret) => `def ${name}(${params}):\n    # tu código aquí\n    return ${ret}\n`;
const js = (name, params, ret) => `function ${name}(${params}) {\n  // tu código aquí\n  return ${ret};\n}\n`;

const CHALLENGES = [
  // ---------------- Fácil ----------------
  {
    id: 'fizzbuzz', title: 'FizzBuzz', difficulty: 'Fácil', topic: 'Lógica', minutes: 10,
    description:
      'Escribe una función que reciba un entero `n` y regrese una lista con los números del 1 a `n` como texto, ' +
      'reemplazando los múltiplos de 3 por "Fizz", los de 5 por "Buzz" y los de ambos por "FizzBuzz".',
    fn: { python: 'fizzbuzz', javascript: 'fizzbuzz' },
    starter: { python: py('fizzbuzz', 'n', '[]'), javascript: js('fizzbuzz', 'n', '[]') },
    tests: [
      { args: [3], expected: ['1', '2', 'Fizz'] },
      { args: [5], expected: ['1', '2', 'Fizz', '4', 'Buzz'] },
      { args: [15], expected: ['1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz', '11', 'Fizz', '13', '14', 'FizzBuzz'] },
      { args: [0], expected: [], hidden: true },
      { args: [1], expected: ['1'], hidden: true },
    ],
  },
  {
    id: 'reverse-words', title: 'Invertir palabras', difficulty: 'Fácil', topic: 'Strings', minutes: 10,
    description:
      'Dado un texto `s`, regresa las palabras en orden inverso separadas por un solo espacio. ' +
      'Ignora espacios al inicio, al final y espacios repetidos entre palabras.',
    fn: { python: 'reverse_words', javascript: 'reverseWords' },
    starter: { python: py('reverse_words', 's', '""'), javascript: js('reverseWords', 's', "''") },
    tests: [
      { args: ['hola mundo'], expected: 'mundo hola' },
      { args: ['  el cielo es azul  '], expected: 'azul es cielo el' },
      { args: ['a   b'], expected: 'b a' },
      { args: [''], expected: '', hidden: true },
      { args: ['uno'], expected: 'uno', hidden: true },
    ],
  },
  {
    id: 'palindrome', title: 'Palíndromo', difficulty: 'Fácil', topic: 'Strings', minutes: 10,
    description:
      'Determina si el texto `s` es un palíndromo considerando solo letras y números e ignorando mayúsculas/minúsculas. ' +
      'Regresa `true`/`True` o `false`/`False`.',
    fn: { python: 'is_palindrome', javascript: 'isPalindrome' },
    starter: { python: py('is_palindrome', 's', 'False'), javascript: js('isPalindrome', 's', 'false') },
    tests: [
      { args: ['A man, a plan, a canal: Panama'], expected: true },
      { args: ['race a car'], expected: false },
      { args: ['Anita lava la tina'], expected: true },
      { args: [''], expected: true, hidden: true },
      { args: ['0P'], expected: false, hidden: true },
    ],
  },
  {
    id: 'two-sum', title: 'Two Sum', difficulty: 'Fácil', topic: 'Arreglos / Hash', minutes: 15,
    description:
      'Dado un arreglo de enteros `nums` y un entero `target`, regresa los índices `[i, j]` (con `i < j`) de los dos ' +
      'números que suman `target`. Siempre existe exactamente una solución. Intenta hacerlo en O(n).',
    fn: { python: 'two_sum', javascript: 'twoSum' },
    starter: { python: py('two_sum', 'nums, target', '[]'), javascript: js('twoSum', 'nums, target', '[]') },
    tests: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1] },
      { args: [[-1, -2, -3, -4, -5], -8], expected: [2, 4], hidden: true },
      { args: [[0, 4, 3, 0], 0], expected: [0, 3], hidden: true },
    ],
  },
  {
    id: 'valid-parentheses', title: 'Paréntesis válidos', difficulty: 'Fácil', topic: 'Pilas', minutes: 15,
    description:
      'Dado un string `s` que contiene solo los caracteres `()[]{}`, determina si es válido: cada apertura debe ' +
      'cerrarse con el mismo tipo y en el orden correcto.',
    fn: { python: 'is_valid', javascript: 'isValid' },
    starter: { python: py('is_valid', 's', 'False'), javascript: js('isValid', 's', 'false') },
    tests: [
      { args: ['()'], expected: true },
      { args: ['()[]{}'], expected: true },
      { args: ['(]'], expected: false },
      { args: ['([{}])'], expected: true },
      { args: [''], expected: true, hidden: true },
      { args: ['(('], expected: false, hidden: true },
      { args: ['){'], expected: false, hidden: true },
    ],
  },
  {
    id: 'binary-search', title: 'Búsqueda binaria', difficulty: 'Fácil', topic: 'Búsqueda', minutes: 15,
    description:
      'Dado un arreglo `nums` ordenado de forma ascendente y sin repetidos, regresa el índice de `target` o `-1` si no existe. ' +
      'Debe ser O(log n).',
    fn: { python: 'search', javascript: 'search' },
    starter: { python: py('search', 'nums, target', '-1'), javascript: js('search', 'nums, target', '-1') },
    tests: [
      { args: [[-1, 0, 3, 5, 9, 12], 9], expected: 4 },
      { args: [[-1, 0, 3, 5, 9, 12], 2], expected: -1 },
      { args: [[5], 5], expected: 0 },
      { args: [[], 1], expected: -1, hidden: true },
      { args: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 1], expected: 0, hidden: true },
      { args: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 10], expected: 9, hidden: true },
    ],
  },
  {
    id: 'roman-to-int', title: 'Romano a entero', difficulty: 'Fácil', topic: 'Strings', minutes: 15,
    description:
      'Convierte un número romano `s` (I, V, X, L, C, D, M) a entero. Recuerda la regla de resta: ' +
      'IV = 4, IX = 9, XL = 40, XC = 90, CD = 400, CM = 900.',
    fn: { python: 'roman_to_int', javascript: 'romanToInt' },
    starter: { python: py('roman_to_int', 's', '0'), javascript: js('romanToInt', 's', '0') },
    tests: [
      { args: ['III'], expected: 3 },
      { args: ['LVIII'], expected: 58 },
      { args: ['MCMXCIV'], expected: 1994 },
      { args: ['IV'], expected: 4, hidden: true },
      { args: ['MMMCMXCIX'], expected: 3999, hidden: true },
    ],
  },
  {
    id: 'word-frequency', title: 'Frecuencia de palabras', difficulty: 'Fácil', topic: 'Hash maps', minutes: 15,
    description:
      'Dado un texto, regresa un diccionario/objeto con cuántas veces aparece cada palabra. Convierte todo a minúsculas ' +
      'y considera como palabra cualquier secuencia de letras a-z (ignora puntuación y números).',
    fn: { python: 'word_count', javascript: 'wordCount' },
    starter: { python: py('word_count', 'text', '{}'), javascript: js('wordCount', 'text', '{}') },
    tests: [
      { args: ['hola hola mundo'], expected: { hola: 2, mundo: 1 } },
      { args: ['Uno, dos; UNO! dos dos.'], expected: { uno: 2, dos: 3 } },
      { args: [''], expected: {}, hidden: true },
      { args: ['a1b a'], expected: { a: 2, b: 1 }, hidden: true },
    ],
  },
  // ---------------- Media ----------------
  {
    id: 'longest-unique', title: 'Subcadena sin repetidos', difficulty: 'Media', topic: 'Ventana deslizante', minutes: 25,
    description:
      'Dado un string `s`, regresa la longitud de la subcadena más larga que no tenga caracteres repetidos. ' +
      'Ejemplo: "abcabcbb" → 3 ("abc").',
    fn: { python: 'length_of_longest', javascript: 'lengthOfLongest' },
    starter: { python: py('length_of_longest', 's', '0'), javascript: js('lengthOfLongest', 's', '0') },
    tests: [
      { args: ['abcabcbb'], expected: 3 },
      { args: ['bbbbb'], expected: 1 },
      { args: ['pwwkew'], expected: 3 },
      { args: [''], expected: 0, hidden: true },
      { args: ['dvdf'], expected: 3, hidden: true },
      { args: ['abba'], expected: 2, hidden: true },
    ],
  },
  {
    id: 'merge-intervals', title: 'Fusionar intervalos', difficulty: 'Media', topic: 'Ordenamiento', minutes: 25,
    description:
      'Dada una lista de intervalos `[inicio, fin]`, fusiona todos los que se traslapen y regresa la lista ' +
      'resultante ordenada por inicio. Intervalos que se tocan (ej. [1,4] y [4,5]) también se fusionan.',
    fn: { python: 'merge', javascript: 'merge' },
    starter: { python: py('merge', 'intervals', '[]'), javascript: js('merge', 'intervals', '[]') },
    tests: [
      { args: [[[1, 3], [2, 6], [8, 10], [15, 18]]], expected: [[1, 6], [8, 10], [15, 18]] },
      { args: [[[1, 4], [4, 5]]], expected: [[1, 5]] },
      { args: [[[4, 7], [1, 4]]], expected: [[1, 7]], hidden: true },
      { args: [[[1, 4], [2, 3]]], expected: [[1, 4]], hidden: true },
      { args: [[]], expected: [], hidden: true },
    ],
  },
  {
    id: 'max-subarray', title: 'Subarreglo de suma máxima', difficulty: 'Media', topic: 'Programación dinámica', minutes: 20,
    description:
      'Dado un arreglo de enteros `nums` (no vacío), regresa la suma más grande de un subarreglo contiguo. ' +
      'Busca una solución O(n) (algoritmo de Kadane).',
    fn: { python: 'max_subarray', javascript: 'maxSubarray' },
    starter: { python: py('max_subarray', 'nums', '0'), javascript: js('maxSubarray', 'nums', '0') },
    tests: [
      { args: [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], expected: 6 },
      { args: [[1]], expected: 1 },
      { args: [[5, 4, -1, 7, 8]], expected: 23 },
      { args: [[-3, -1, -2]], expected: -1, hidden: true },
      { args: [[2, -1, 2, -1, 2]], expected: 4, hidden: true },
    ],
  },
  {
    id: 'flatten', title: 'Aplanar lista anidada', difficulty: 'Media', topic: 'Recursión', minutes: 20,
    description:
      'Dada una lista que puede contener números u otras listas (a cualquier profundidad), regresa una lista plana ' +
      'con todos los números en el mismo orden. No uses funciones de la librería estándar que lo hagan por ti (ej. `Array.flat`).',
    fn: { python: 'flatten', javascript: 'flatten' },
    starter: { python: py('flatten', 'items', '[]'), javascript: js('flatten', 'items', '[]') },
    tests: [
      { args: [[1, [2, 3], 4]], expected: [1, 2, 3, 4] },
      { args: [[[1, [2, [3, [4]]]], 5]], expected: [1, 2, 3, 4, 5] },
      { args: [[]], expected: [] },
      { args: [[[], [[]], [1]]], expected: [1], hidden: true },
      { args: [[[[[[7]]]]]], expected: [7], hidden: true },
    ],
  },
  {
    id: 'rotate-matrix', title: 'Rotar matriz', difficulty: 'Media', topic: 'Matrices', minutes: 20,
    description:
      'Dada una matriz cuadrada `matrix` de n×n, regresa una nueva matriz rotada 90° en el sentido de las manecillas del reloj.',
    fn: { python: 'rotate', javascript: 'rotate' },
    starter: { python: py('rotate', 'matrix', '[]'), javascript: js('rotate', 'matrix', '[]') },
    tests: [
      { args: [[[1, 2], [3, 4]]], expected: [[3, 1], [4, 2]] },
      { args: [[[1, 2, 3], [4, 5, 6], [7, 8, 9]]], expected: [[7, 4, 1], [8, 5, 2], [9, 6, 3]] },
      { args: [[[1]]], expected: [[1]], hidden: true },
      { args: [[[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16]]], expected: [[13, 9, 5, 1], [14, 10, 6, 2], [15, 11, 7, 3], [16, 12, 8, 4]], hidden: true },
    ],
  },
  {
    id: 'top-k-frequent', title: 'Top K más frecuentes', difficulty: 'Media', topic: 'Hash maps / Ordenamiento', minutes: 25,
    description:
      'Dado un arreglo `nums` y un entero `k`, regresa los `k` números más frecuentes ordenados por frecuencia descendente; ' +
      'en caso de empate, el número menor va primero.',
    fn: { python: 'top_k_frequent', javascript: 'topKFrequent' },
    starter: { python: py('top_k_frequent', 'nums, k', '[]'), javascript: js('topKFrequent', 'nums, k', '[]') },
    tests: [
      { args: [[1, 1, 1, 2, 2, 3], 2], expected: [1, 2] },
      { args: [[1], 1], expected: [1] },
      { args: [[4, 4, 5, 5, 6], 2], expected: [4, 5] },
      { args: [[3, 3, 1, 1, 2, 2, 2], 3], expected: [2, 1, 3], hidden: true },
      { args: [[-1, -1, 7], 1], expected: [-1], hidden: true },
    ],
  },
  // ---------------- Difícil ----------------
  {
    id: 'num-islands', title: 'Número de islas', difficulty: 'Difícil', topic: 'Grafos (BFS/DFS)', minutes: 30,
    description:
      'Dada una cuadrícula `grid` de 1 (tierra) y 0 (agua), regresa cuántas islas hay. Una isla es un grupo de 1 conectados ' +
      'horizontal o verticalmente (no en diagonal).',
    fn: { python: 'num_islands', javascript: 'numIslands' },
    starter: { python: py('num_islands', 'grid', '0'), javascript: js('numIslands', 'grid', '0') },
    tests: [
      { args: [[[1, 1, 0, 0], [1, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]], expected: 3 },
      { args: [[[1, 1, 1], [0, 1, 0], [1, 1, 1]]], expected: 1 },
      { args: [[[0, 0], [0, 0]]], expected: 0 },
      { args: [[[1, 0, 1, 0, 1]]], expected: 3, hidden: true },
      { args: [[]], expected: 0, hidden: true },
      { args: [[[1, 0], [0, 1]]], expected: 2, hidden: true },
    ],
  },
  {
    id: 'coin-change', title: 'Cambio de monedas', difficulty: 'Difícil', topic: 'Programación dinámica', minutes: 30,
    description:
      'Dadas las denominaciones `coins` (cantidad ilimitada de cada una) y un monto `amount`, regresa el mínimo número de ' +
      'monedas para formar el monto, o `-1` si no es posible.',
    fn: { python: 'coin_change', javascript: 'coinChange' },
    starter: { python: py('coin_change', 'coins, amount', '-1'), javascript: js('coinChange', 'coins, amount', '-1') },
    tests: [
      { args: [[1, 2, 5], 11], expected: 3 },
      { args: [[2], 3], expected: -1 },
      { args: [[1], 0], expected: 0 },
      { args: [[1, 3, 4], 6], expected: 2, hidden: true },
      { args: [[186, 419, 83, 408], 6249], expected: 20, hidden: true },
    ],
  },
  {
    id: 'lru-cache', title: 'Simular caché LRU', difficulty: 'Difícil', topic: 'Diseño de estructuras', minutes: 35,
    description:
      'Simula una caché LRU de capacidad `capacity`. Recibes una lista de operaciones: `["put", clave, valor]` o `["get", clave]`. ' +
      'Regresa una lista con el resultado de cada `get` (el valor, o `-1` si no existe). Al insertar con la caché llena, ' +
      'elimina la clave usada hace más tiempo. Tanto `get` como `put` cuentan como uso. Ideal O(1) por operación.',
    fn: { python: 'lru_simulate', javascript: 'lruSimulate' },
    starter: { python: py('lru_simulate', 'capacity, ops', '[]'), javascript: js('lruSimulate', 'capacity, ops', '[]') },
    tests: [
      { args: [2, [['put', 1, 1], ['put', 2, 2], ['get', 1], ['put', 3, 3], ['get', 2], ['put', 4, 4], ['get', 1], ['get', 3], ['get', 4]]], expected: [1, -1, -1, 3, 4] },
      { args: [1, [['put', 1, 10], ['get', 1], ['put', 2, 20], ['get', 1], ['get', 2]]], expected: [10, -1, 20] },
      { args: [2, [['put', 1, 1], ['put', 1, 5], ['get', 1]]], expected: [5], hidden: true },
      { args: [2, [['put', 1, 1], ['put', 2, 2], ['put', 1, 9], ['put', 3, 3], ['get', 2], ['get', 1]]], expected: [-1, 9], hidden: true },
    ],
  },
];

// ---------------- Traducciones al inglés ----------------
const EN = {
  'fizzbuzz': { title: 'FizzBuzz', topic: 'Logic', description: 'Write a function that takes an integer `n` and returns a list with the numbers from 1 to `n` as strings, replacing multiples of 3 with "Fizz", multiples of 5 with "Buzz" and multiples of both with "FizzBuzz".' },
  'reverse-words': { title: 'Reverse words', topic: 'Strings', description: 'Given a string `s`, return its words in reverse order separated by a single space. Ignore leading and trailing spaces and repeated spaces between words.' },
  'palindrome': { title: 'Palindrome', topic: 'Strings', description: 'Determine whether the string `s` is a palindrome considering only letters and digits and ignoring case. Return `true`/`True` or `false`/`False`.' },
  'two-sum': { title: 'Two Sum', topic: 'Arrays / Hashing', description: 'Given an array of integers `nums` and an integer `target`, return the indices `[i, j]` (with `i < j`) of the two numbers that add up to `target`. There is always exactly one solution. Try to do it in O(n).' },
  'valid-parentheses': { title: 'Valid parentheses', topic: 'Stacks', description: 'Given a string `s` containing only the characters `()[]{}`, determine whether it is valid: every opening bracket must be closed by the same type and in the correct order.' },
  'binary-search': { title: 'Binary search', topic: 'Searching', description: 'Given an array `nums` sorted in ascending order with no duplicates, return the index of `target` or `-1` if it does not exist. It must be O(log n).' },
  'roman-to-int': { title: 'Roman to integer', topic: 'Strings', description: 'Convert a Roman numeral `s` (I, V, X, L, C, D, M) to an integer. Remember the subtraction rule: IV = 4, IX = 9, XL = 40, XC = 90, CD = 400, CM = 900.' },
  'word-frequency': { title: 'Word frequency', topic: 'Hash maps', description: 'Given a text, return a dictionary/object with how many times each word appears. Convert everything to lowercase and treat any sequence of letters a-z as a word (ignore punctuation and digits).' },
  'longest-unique': { title: 'Longest substring without repeats', topic: 'Sliding window', description: 'Given a string `s`, return the length of the longest substring without repeating characters. Example: "abcabcbb" → 3 ("abc").' },
  'merge-intervals': { title: 'Merge intervals', topic: 'Sorting', description: 'Given a list of intervals `[start, end]`, merge all overlapping intervals and return the resulting list sorted by start. Intervals that touch (e.g. [1,4] and [4,5]) are also merged.' },
  'max-subarray': { title: 'Maximum subarray', topic: 'Dynamic programming', description: 'Given a non-empty array of integers `nums`, return the largest sum of a contiguous subarray. Aim for an O(n) solution (Kadane’s algorithm).' },
  'flatten': { title: 'Flatten nested list', topic: 'Recursion', description: 'Given a list that may contain numbers or other lists (at any depth), return a flat list with all the numbers in the same order. Do not use standard library functions that do it for you (e.g. `Array.flat`).' },
  'rotate-matrix': { title: 'Rotate matrix', topic: 'Matrices', description: 'Given an n×n square `matrix`, return a new matrix rotated 90° clockwise.' },
  'top-k-frequent': { title: 'Top K frequent', topic: 'Hash maps / Sorting', description: 'Given an array `nums` and an integer `k`, return the `k` most frequent numbers sorted by descending frequency; on ties, the smaller number comes first.' },
  'num-islands': { title: 'Number of islands', topic: 'Graphs (BFS/DFS)', description: 'Given a `grid` of 1s (land) and 0s (water), return how many islands there are. An island is a group of 1s connected horizontally or vertically (not diagonally).' },
  'coin-change': { title: 'Coin change', topic: 'Dynamic programming', description: 'Given the denominations `coins` (unlimited supply of each) and an amount `amount`, return the minimum number of coins needed to make up the amount, or `-1` if it is not possible.' },
  'lru-cache': { title: 'Simulate an LRU cache', topic: 'Data structure design', description: 'Simulate an LRU cache with capacity `capacity`. You receive a list of operations: `["put", key, value]` or `["get", key]`. Return a list with the result of each `get` (the value, or `-1` if it does not exist). When inserting into a full cache, evict the least recently used key. Both `get` and `put` count as a use. Ideally O(1) per operation.' },
};
for (const c of CHALLENGES) if (EN[c.id]) c.en = EN[c.id];

// Código inicial con el comentario en el idioma del candidato.
// ---------------- Java ----------------
// Firma del método (estilo LeetCode: clase Solution con método de instancia), tipos de los
// parámetros (para convertir los casos JSON a literales de Java) y valor de retorno inicial.
const JAVA = {
  'fizzbuzz': ['public List<String> fizzbuzz(int n)', ['int'], 'new ArrayList<>()'],
  'reverse-words': ['public String reverseWords(String s)', ['String'], '""'],
  'palindrome': ['public boolean isPalindrome(String s)', ['String'], 'false'],
  'two-sum': ['public int[] twoSum(int[] nums, int target)', ['int[]', 'int'], 'new int[0]'],
  'valid-parentheses': ['public boolean isValid(String s)', ['String'], 'false'],
  'binary-search': ['public int search(int[] nums, int target)', ['int[]', 'int'], '-1'],
  'roman-to-int': ['public int romanToInt(String s)', ['String'], '0'],
  'word-frequency': ['public Map<String, Integer> wordCount(String text)', ['String'], 'new HashMap<>()'],
  'longest-unique': ['public int lengthOfLongest(String s)', ['String'], '0'],
  'merge-intervals': ['public int[][] merge(int[][] intervals)', ['int[][]'], 'new int[0][]'],
  'max-subarray': ['public int maxSubarray(int[] nums)', ['int[]'], '0'],
  'flatten': ['public List<Integer> flatten(List<Object> items)', ['List<Object>'], 'new ArrayList<>()'],
  'rotate-matrix': ['public int[][] rotate(int[][] matrix)', ['int[][]'], 'new int[0][]'],
  'top-k-frequent': ['public int[] topKFrequent(int[] nums, int k)', ['int[]', 'int'], 'new int[0]'],
  'num-islands': ['public int numIslands(int[][] grid)', ['int[][]'], '0'],
  'coin-change': ['public int coinChange(int[] coins, int amount)', ['int[]', 'int'], '-1'],
  'lru-cache': ['public List<Integer> lruSimulate(int capacity, List<List<Object>> ops)', ['int', 'List<List<Object>>'], 'new ArrayList<>()'],
};
for (const c of CHALLENGES) {
  const j = JAVA[c.id]; if (!j) continue;
  const [sig, params, ret] = j;
  c.java = { sig, params };
  c.fn.java = /(\w+)\s*\(/.exec(sig)[1];
  c.starter.java = `import java.util.*;\n\nclass Solution {\n    ${sig} {\n        // tu código aquí\n        return ${ret};\n    }\n}\n`;
}

const starterFor = (c, lang, ui) => (ui === 'en' ? c.starter[lang].replace('tu código aquí', 'your code here') : c.starter[lang]);

module.exports = CHALLENGES;
module.exports.starterFor = starterFor;
