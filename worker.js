importScripts('libs/soljson-v0.7.3+commit.9bfce1f6.js')
//importScripts('libs/soljson-v0.6.7+commit.b8d736ae.js')
importScripts('libs/solc.bundle.js');

onmessage = (e) => {
    let result = JSON.parse(
        solc.compile(JSON.stringify({
            language: 'Solidity',
            sources: e.data,
            settings: { outputSelection: { '*': { '*': ['*'] }}}
        }))
    )
    result.sources = e.data
    postMessage(result)
}