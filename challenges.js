// Catálogo estático de ejercicios. Cada uno tiene instrucciones, la función a
// implementar por lenguaje, código inicial y casos de prueba { args, expected }.
// Los casos con `hidden: true` nunca se envían al candidato: solo el admin los ve
// y los ejecuta. Para agregar un ejercicio, copia uno y ajústalo.

const py = (name, params, ret) => `def ${name}(${params}):\n    # tu código aquí\n    return ${ret}\n`;
const js = (name, params, ret) => `function ${name}(${params}) {\n  // tu código aquí\n  return ${ret};\n}\n`;

module.exports = [
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
