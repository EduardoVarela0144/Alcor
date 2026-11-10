// Banco estático de retos. Cada reto tiene enunciado, firma por lenguaje,
// código inicial y casos de prueba. Los casos con `hidden: true` nunca se
// envían al candidato: solo el administrador los ve y los ejecuta.

module.exports = [
  {
    id: 'fizzbuzz',
    title: 'FizzBuzz',
    difficulty: 'Fácil',
    minutes: 15,
    description:
      'Escribe una función que reciba un entero `n` y regrese una lista con los números del 1 a `n` como texto, ' +
      'reemplazando los múltiplos de 3 por "Fizz", los de 5 por "Buzz" y los de ambos por "FizzBuzz".',
    fn: { python: 'fizzbuzz', javascript: 'fizzbuzz' },
    starter: {
      python: 'def fizzbuzz(n):\n    # tu código aquí\n    return []\n',
      javascript: 'function fizzbuzz(n) {\n  // tu código aquí\n  return [];\n}\n',
    },
    tests: [
      { args: [3], expected: ['1', '2', 'Fizz'] },
      { args: [5], expected: ['1', '2', 'Fizz', '4', 'Buzz'] },
      { args: [15], expected: ['1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz', '11', 'Fizz', '13', '14', 'FizzBuzz'] },
      { args: [0], expected: [], hidden: true },
      { args: [1], expected: ['1'], hidden: true },
    ],
  },
  {
    id: 'two-sum',
    title: 'Two Sum',
    difficulty: 'Fácil',
    minutes: 20,
    description:
      'Dado un arreglo de enteros `nums` y un entero `target`, regresa los índices `[i, j]` (con `i < j`) de los dos ' +
      'números que suman `target`. Siempre existe exactamente una solución. Intenta hacerlo en O(n).',
    fn: { python: 'two_sum', javascript: 'twoSum' },
    starter: {
      python: 'def two_sum(nums, target):\n    # tu código aquí\n    return []\n',
      javascript: 'function twoSum(nums, target) {\n  // tu código aquí\n  return [];\n}\n',
    },
    tests: [
      { args: [[2, 7, 11, 15], 9], expected: [0, 1] },
      { args: [[3, 2, 4], 6], expected: [1, 2] },
      { args: [[3, 3], 6], expected: [0, 1] },
      { args: [[-1, -2, -3, -4, -5], -8], expected: [2, 4], hidden: true },
      { args: [[0, 4, 3, 0], 0], expected: [0, 3], hidden: true },
    ],
  },
  {
    id: 'valid-parentheses',
    title: 'Paréntesis válidos',
    difficulty: 'Fácil',
    minutes: 20,
    description:
      'Dado un string `s` que contiene solo los caracteres `()[]{}`, determina si es válido: cada apertura debe ' +
      'cerrarse con el mismo tipo y en el orden correcto. Regresa `true`/`True` o `false`/`False`.',
    fn: { python: 'is_valid', javascript: 'isValid' },
    starter: {
      python: 'def is_valid(s):\n    # tu código aquí\n    return False\n',
      javascript: 'function isValid(s) {\n  // tu código aquí\n  return false;\n}\n',
    },
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
    id: 'longest-unique',
    title: 'Subcadena sin repetidos',
    difficulty: 'Media',
    minutes: 30,
    description:
      'Dado un string `s`, regresa la longitud de la subcadena más larga que no tenga caracteres repetidos. ' +
      'Ejemplo: "abcabcbb" → 3 ("abc").',
    fn: { python: 'length_of_longest', javascript: 'lengthOfLongest' },
    starter: {
      python: 'def length_of_longest(s):\n    # tu código aquí\n    return 0\n',
      javascript: 'function lengthOfLongest(s) {\n  // tu código aquí\n  return 0;\n}\n',
    },
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
    id: 'merge-intervals',
    title: 'Fusionar intervalos',
    difficulty: 'Media',
    minutes: 30,
    description:
      'Dada una lista de intervalos `[inicio, fin]`, fusiona todos los que se traslapen y regresa la lista ' +
      'resultante ordenada por inicio. Intervalos que se tocan (ej. [1,4] y [4,5]) también se fusionan.',
    fn: { python: 'merge', javascript: 'merge' },
    starter: {
      python: 'def merge(intervals):\n    # tu código aquí\n    return []\n',
      javascript: 'function merge(intervals) {\n  // tu código aquí\n  return [];\n}\n',
    },
    tests: [
      { args: [[[1, 3], [2, 6], [8, 10], [15, 18]]], expected: [[1, 6], [8, 10], [15, 18]] },
      { args: [[[1, 4], [4, 5]]], expected: [[1, 5]] },
      { args: [[[4, 7], [1, 4]]], expected: [[1, 7]], hidden: true },
      { args: [[[1, 4], [2, 3]]], expected: [[1, 4]], hidden: true },
      { args: [[]], expected: [], hidden: true },
    ],
  },
];
