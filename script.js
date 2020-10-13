let $ = jQuery

function log(msg) {
    if (msg) $('#message').append('<br>' + msg)
    return msg
}

function logResultAs(title) {
    return (result) => {
        console.log(title + ': ' + result)
        return result
    }
}

function compiled(result) {
    if (result.errors) {
        result.errors.forEach(e =>
            log('<br>' + e.formattedMessage))
        return
    }
    let names = Object.keys(result.contracts['Exchange.sol'])
    window.source = result.sources['Exchange.sol'].content
    names.sort((a, b) =>
        window.source.search('contract ' + a) -
        window.source.search('contract ' + b))
    window.name = names[names.length - 1]
    names.forEach(name => log('Compiled ' + name))
    $('span.name').text(name)
    document.title = 'Masterchain ' + name
    let contract = result.contracts['Exchange.sol'][name]
    window.contract = ethers.ContractFactory.fromSolidity(contract)
    let bytecode = window.contract.bytecode
    let content = bytecode.slice(2, 128).replace(/(..)/g, (_, byte) => byte + ' ')
    content += '... (' + bytecode.length / 2 + ' bytes)'
    $('#bytecode .content').text(content)
    $('#bytecode').css('display', 'block')
    let hrefAddress = location.href.search('#') + 1
    hrefAddress = hrefAddress ? location.href.slice(hrefAddress) : ''
    window.address = window.address ? '' : hrefAddress
    $('#contract input[name="address"]').val(address)
    $('#contract').css('display', 'block')
    if (address)
        setTimeout(() => $('#open').click(), 1000)
}

$(() => {
    $('#wrapper').load('Exchange.sol', () => {
        window.editor = ace.edit('editor')
        editor.setTheme('ace/theme/monokai')
        editor.session.setMode('ace/mode/solidity')
        let lines = window.editor.getSession().getDocument().getLength()
        $('#editor').css({height: lines * 1.1 + 'em', display: 'inline-block'})
        setTimeout(() => window.scrollTo(0, 0), 500)
        setTimeout(() => $('#connect').click(), 1000)
        $('input[name="url"]').val(window.location.href + 'web3')
    })

    window.solc = new Worker('worker.js')
    window.solc.onmessage = (e) => compiled(e.data)
    let compileButton = $("#compile")
    compileButton.click(() => {
        window.solc.postMessage({
            'Exchange.sol': {
                content: window.editor.getValue()
            }
        })
    })
    compileButton.css('display', 'inline-block')
    setTimeout(() => compileButton.click(), 1000)
})

let algorithms = {
    'SHA1': cadesplugin.CADESCOM_HASH_ALGORITHM_SHA1,
    'GOST': cadesplugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256
}

function b64(bytes) {
    return btoa(String.fromCharCode.apply(null, bytes))
}

function calcHash(alg, base64) {
    return cadesplugin.CreateObjectAsync("CAdESCOM.HashedData").then(hash =>
        hash.propset_DataEncoding(cadesplugin.CADESCOM_BASE64_TO_BINARY).then(_ =>
        hash.propset_Algorithm(algorithms[alg]).then(_ =>
        hash.Hash(base64)).then(() => hash)))
}

function help() {
    $('#accounts').html('Please install first:<ol>' +
        '<li><a href="https://www.cryptopro.ru/products/csp/downloads">CryptoPro CSP</a></li>' +
        '<li><a href="https://www.cryptopro.ru/products/cades/plugin/get_2_0">Browser plugin</a></li>' +
        '<li><a href="https://github.com/deemru/chromium-gost/releases">Сhromium GOST</a></li>' +
        '<li><a href="keys.pfx">Key containers</a></li>' +
        '</ol>')
}

let keyIsEnabled = '0xc195f04f000000000000000000000000'
let retries = 10

function b2c(bytes) {
    let r = bytes.reduce((r, b) => [r[0] * 256 + b, r[1] * 256], [0, 1])
    return Math.floor(156 + 100 * r[0] / r[1]).toString(16).padStart(2, '0')
}

function colorize(selector) {
    $(selector).each((_, e) => {
        if (e.innerText || e.value) {
            let bytes = hexToArray(e.innerText || e.value)
            let r = b2c(bytes.slice(0, 7))
            let g = b2c(bytes.slice(7, 14))
            let b = b2c(bytes.slice(14, 20))
            e.style.backgroundColor = '#' + r + g + b
        } else {
            delete e.style.backgroundColor
        }
    })
}

function loadAccounts() {
    if (!cadesplugin) {
        if (retries--) setTimeout(loadAccounts, 1000)
        else help()
        return
    }
    cadesplugin.then(() => {
    window.web3.send('admin_nodeInfo').then(nodeInfo => nodeInfo.registry).then(
    logResultAs('Registry address')).then(registry => {
    let accountEnabled = (account) =>
        window.web3.send('eth_call', [{to: registry, data: keyIsEnabled + account.slice(2)}, 'latest'])
            .then(result => result.endsWith('1')) // true
    cadesplugin.CreateObjectAsync("CAdESCOM.Store").then(store =>
    store.Open().then(() =>
    store.Certificates.then(certs =>
    certs.Count.then(count =>
    [...Array(count)].reduce((promise, _, i) =>
        promise.then(collector =>
        certs.Item(i).then(cert =>
        cert.HasPrivateKey().then(
            has => !has ? collector :
                cert.PublicKey().then(pubkey =>
                pubkey.EncodedKey.then(encoded =>
                encoded.Value().then(b64 =>
                calcHash('SHA1', b64).then(hash =>
                hash.Value.then(skid => {
                    collector['0x' + skid] = cert
                    return collector
                }))))))
            , error => {
                console.log('Certificate', i, 'of', count, 'error:', error.message)
                return collector
            })
        ), Promise.resolve({}) // collect certificates into empty Object
    )))).then(certificates => {
        store.Close()
        window.accounts = []
        window.certificates = []
        window.selected = 0
        let index = 0
        Object.keys(certificates).reduce((p, account) =>
            p.then(_ => accountEnabled(account)).then(enabled => {
                if (enabled) {
                    window.accounts.push(account)
                    window.certificates.push(certificates[account])
                    $('#accounts').append(
                        '<div>' +
                        '<input name="accounts" type="radio" value="' + index + '"' +
                        (index === window.selected ? ' checked ' : '') + '/>' +
                        '<span>' + index + ':</span>' +
                        '</div>' +
                        '<pre class="addr">' + account + '</pre><br>'
                    )
                    index++
                }}), Promise.resolve()
        ).then(_ => {
            $('input[name=accounts]').change((event) => {
                window.selected = parseInt(event.target.value)
                window.account = window.accounts[window.selected]
                window.certificate = window.certificates[window.selected]
                window.signer = window.web3.getUncheckedSigner(window.account)
            })
            $('#accounts span').click((event) => {
                $(event.target.previousSibling).click()
            })
            $('#accounts span:first-child').click()
            $('#accounts').css('display', 'block')
            colorize($('#accounts pre'))
        })
    }))})}, help)
}

$('#connect').click(() => {
    window.web3url = $('#node input[name="url"]').val()
    window.web3 = new ethers.providers.JsonRpcProvider(web3url)
    loadAccounts()
})

function hexToArray(hex) {
    if (hex.startsWith('0x'))
        hex = hex.slice(2)
    if (hex.length % 2)
        hex = '0' + hex
    let b = hex.match(/.{1,2}/g) || []
    let c = b.map(byte => parseInt(byte, 16))
    return new Uint8Array(c)
}

function encodeTx(from, nonce, to, data, signature) {
    let args = [
        /* nonce     */ nonce ? nonce.toString(16) : '',
        /* gasPrice  */ '3b9aca00',
        /* gasLimit  */ '1000000000',
        /* !! sender */ from,
        /* recipient */ to || '',
        /* value     */ '',
        /* data      */ data,
    ]
    if (signature)
        args.push(signature)
    return ethers.utils.RLP.encode(args.map(hexToArray))
}

function sendTxTo(recipient, data) {
    console.log('sending to', recipient, data)
    return new Promise((resolve) =>
        window.signer.getTransactionCount().then(nonce => {
        let unsignedTx = encodeTx(window.account, nonce, recipient, data)
        cadesplugin.then(_ =>
        calcHash('GOST', b64(hexToArray(unsignedTx)))).then(hash =>
        hash.Value.then(logResultAs('GOST hash')).then(_ =>
        cadesplugin.CreateObjectAsync("CAdESCOM.RawSignature")).then(sign =>
        sign.SignHash(hash, window.certificate).then(
        logResultAs('signature')).then(signature =>
        encodeTx(window.account, nonce, recipient, data, signature)).then(
        logResultAs('signed tx')).then(signedTx =>
        window.web3.send('eth_sendRawTransaction', [signedTx])).then(
        logResultAs('polling tx')).then(txHash => {
            let handle = setInterval(() =>
                window.web3.getTransactionReceipt(txHash).then(receipt => {
                    if (receipt) {
                        window.clearInterval(handle)
                        resolve(receipt)
                    }
                }), 1000)
        })))}))
}

$('#deploy').click(() =>
    sendTxTo(null, window.contract.bytecode).then(receipt => {
        if (receipt.contractAddress) {
            window.address = receipt.contractAddress
            log('Deployed ' + name + ' at <span class="addr">' + window.address + '</span>')
            $('#contract input[name="address"]').val(window.address)
            colorize('#contract input[name="address"]')
            setTimeout(() => $('#open').click(), 1000)
        } else {
            log('Failed to deploy ' + name)
        }
    })
)

function isAddress(value) {
    return /0x[0-9a-zA-Z]{40}/.test(value)
}

$('#open').click(() => {
    window.address = $('#contract input[name="address"]').val()
    window.instance = new ethers.Contract(window.address, window.contract.interface, window.web3)
    window.methods = Object.values(window.contract.interface.functions)
    let slicedSource = source.slice(source.search('contract ' + name))
    for (i in methods) {
        prefix = methods[i].constant ? 'public ' : 'function '
        methods[i].order = slicedSource.search(prefix + methods[i].name)
    }
    methods.sort((a, b) => a.order - b.order)
    let panel = $('#panel')
    panel.empty()
    methods.forEach((method) => {
        let form = $('<form class="card-panel" action="#">')
        let params = method.inputs.map(
            (input, i) => input.name || 'x' + (i + 1)).join(', ')
        form.append(name + '.' + method.name + '(' + params + '):')
        form.append('<span id="' + method.name + '_value"></span>')
        let show = v => {
            $('#' + method.name + '_value').text(v)
            if (isAddress(v))
                colorize('#' + method.name + '_value')
        }
        form.attr('name', method.name)
        method.inputs.forEach((input, i) => {
            let name = input.type + ' ' + (input.name || 'x' + (i + 1))
            let clazz = input.type === 'address' ? 'class="addr"' : ''
            form.append('<br><label for="' + name + '">' + name + '</label>')
            form.append('<input name="' + name + '" type="text"' + clazz + ' />')
        })
        if (method.constant) {
            if (method.inputs.length === 0) {
                panel.append(form)
                window.instance.callStatic[method.name]().then(show, show)
            } else {
                form.append('<br><a id="' + method.name + '_call" ' +
                    'class="waves-effect waves-light btn">Run' +
                    '<i class="material-icons right">play_arrow</i></a>')
                panel.append(form)
                let thisForm = 'form[name=' + method.name + ']'
                $('#' + method.name + '_call').click(() => {
                    colorize(thisForm + ' input.addr[type=text]')
                    args = $(thisForm + ' input[type=text]').map((i, a) => a.value)
                    window.instance.callStatic[method.name](...args).then(show, show)
                })
            }
        } else {
            form.append('<br><a id="' + method.name + '_send" ' +
                'class="waves-effect waves-light btn">Run' +
                '<i class="material-icons right">play_arrow</i></a>')
            panel.append(form)
            let thisForm = 'form[name=' + method.name + ']'
            $('#' + method.name + '_send').click(() => {
                colorize(thisForm + ' input.addr[type=text]')
                show('pending')
                let args = $(thisForm + ' input[type=text]').map(
                    (i, a) => {
                        if (method.inputs[i].type === 'address') {
                            if (isAddress(a.value))
                                return a.value
                            else {
                                log(a.value + 'must be an address')
                                return ''
                            }
                        } else if (method.inputs[i].type === 'uint256') {
                            if (parseInt(a.value).toString() === a.value)
                                return parseInt(a.value)
                            else {
                                log(a.value + 'must be an integer')
                                return ''
                            }
                        } else if (method.inputs[i].type === 'bool') {
                            if (a.value === 'true')
                                return true
                            else {
                                if (a.value !== 'false')
                                    log(a.value + 'must be true or false')
                                return false
                            }
                        } else return a.value
                    })
                console.log(args)
                window.instance.populateTransaction[method.name](...args).then(tx =>
                sendTxTo(window.address, tx.data)).then(receipt => {
                    if (!receipt || !receipt.status)
                        show('failure')
                    else
                        show('success')
                }, log)
            })
        }
    })
    panel.css('display', 'block')
    $('#editor').css('height', $('body').height())
    window.editor.resize()
})
