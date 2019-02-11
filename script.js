function log(msg) {
  if (msg) $('#message').append('<br>' + msg)
  return msg
}

$(() => {

  $('#wrapper').load('Exchange.sol', () => {
      window.editor = ace.edit('editor')
      editor.setTheme('ace/theme/monokai')
      editor.session.setMode('ace/mode/solidity')
      lines = window.editor.getSession().getDocument().getLength()
      $('#editor').css('height', lines * 1.1 + 'em')
      $('#editor').css('display', 'inline-block')
      setTimeout(() => window.scrollTo(0, 0), 500)
  })

  BrowserSolc.getVersions((_, versions) => {
    version = versions['0.4.21']
    BrowserSolc.loadVersion(version, (compiler) => {
        window.solc = compiler
        $('#message').text('Loaded compiler ' + version)
        $('#compile').css('display', 'inline-block')
        setTimeout(() => $('#compile').click(), 1000)
      })
  })

  window.web3url = $('#node input[name="url"]').text()
  window.web3 = new Web3(new Web3.providers.HttpProvider(web3url))
  web3.personal.getListAccounts(
    (error, accounts) => {
      if (log(error)) return
      window.accounts = accounts
      window.selected = 0
      accounts.forEach((account, index) => {
        $('#accounts').append(
          '<div><label><input name="accounts" type="radio"' +
          (index == selected ? ' checked ' : '') + '/>' +
          '<span>' + account + ':</span></label></div>'
        )
        web3.eth.getBalance(account,
          (error, balance) => {
            if (log(error)) return
            balance = balance.toString().replace(/(\...).*e\+/, "$1^e")
            $('#accounts span')[index].innerHTML += ' ' + balance + ' ТРЕ'
            web3.personal.unlockAccount(account, '', 0,
              (error, balance) => {
                if (log(error)) return
                $('#accounts span')[index].innerHTML += ' unlocked'
              })
          })
      })
      $('#accounts').css('display', 'block')
    })
})

$('#compile').click(() => {
  window.source = window.editor.getValue()
  window.result = window.solc.compile(source, 1)
  if (log(result.errors)) return
  names = Object.keys(result.contracts).map(n => n.slice(1))
  names.sort((a, b) =>
      source.search('contract ' + a) -
      source.search('contract ' + b))
  window.name = names[names.length - 1]
  log('Compiled ' + name)
  $('span.name').text(name)
  window.bytecode = result.contracts[':' + name].bytecode
  window.interface = JSON.parse(result.contracts[':' + name].interface)
  content = bytecode.slice(0, 128).
    replace(/(..)/g, (_, byte) => byte + ' ')
  content += '... (' + bytecode.length / 2 + ' bytes)'
  $('#bytecode .content').text(content)
  $('#bytecode').css('display', 'block')
  hrefAddress = location.href.search('#') + 1
  hrefAddress = hrefAddress ? location.href.slice(hrefAddress) : ''
  window.address = window.address ? '' : hrefAddress
  $('#contract input[name="address"]').val(address)
  $('#contract').css('display', 'block')
  if (address)
    setTimeout(() => $('#open').click(), 1000)
})

$('#deploy').click(() => {
  contract = web3.eth.contract(interface)
  txBody = {from: accounts[selected], gas: 4e6, data: '0x' + bytecode}
  var handle = 0
  contract.new(txBody, (error, result) => {
    if (log(error) || handle) return
    txHash = result.transactionHash
    handle = setInterval(() => {
      receipt = web3.eth.getTransactionReceipt(txHash)
      if (receipt && receipt.contractAddress) {
        window.clearInterval(handle)
        window.address = receipt.contractAddress
        log('Deployed ' + name + ' at ' + address)
        $('#contract input[name="address"]').val(address)
      }
    }, 1000)
  })
})

$('#open').click(() => {
  contract = web3.eth.contract(interface)
  instance = contract.at(window.address)
  window.methods = interface.filter((i) => i.name)
  slicedSource = source.slice(source.search('contract ' + name))
  for (i in methods) {
    prefix = methods[i].constant ? 'public ' : 'function '
    methods[i].order = slicedSource.search(prefix + methods[i].name)
  }
  methods.sort((a, b) => a.order - b.order)
  $('#interface').empty()
  methods.forEach((method) => {
    var form = $('<form class="card-panel" action="#">')
    params = method.inputs.map(
      (input, i) => input.name || 'x' + (i+1)).join(', ')
    form.append(name + '.' + method.name + '(' + params + '):')
    form.attr('name', method.name)
    method.inputs.forEach((input, i) => {
      var name = input.type + ' ' + (input.name || 'x' + (i+1))
      form.append('<br><label for="' + name + '">' + name + '</label>')
      form.append('<input name="' + name + '" type="text" />')
    })
    if (method.constant && method.inputs.length == 0)
      instance[method.name].call((error, result) =>
        form.append((error || '') + ' ' + result)
      )
    else {
      form.append('<br><a id="' + name + '_run" ' +
        'class="waves-effect waves-light btn">Run' +
        '<i class="material-icons right">play_arrow</i></a>')
      thisForm = 'form[name=' + method.name + ']'
      $(thisForm + ' .btn').click(() => {
        arg = $(thisForm + ' input[type=text]')[0].value
        instance[method.name].call(arg, (error, result) =>
          form.append((error || '') + ' ' + result)
        )
      })
    }
    $('#interface').append(form)
  })
  $('#interface').css('display', 'block')
  $('#editor').css('height', $('body').height())
  window.editor.resize()
})
