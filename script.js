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
      setTimeout(() => $('#connect').click(), 1000)
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
})

$('#connect').click(() => {
  window.web3url = $('#node input[name="url"]').val()
  window.web3 = new Web3(new Web3.providers.HttpProvider(web3url))
  web3.personal.getListAccounts(
    (error, accounts) => {
      if (log(error)) return
      window.accounts = accounts
      window.selected = 0
      $('#accounts').empty()
      accounts.forEach((account, index) => {
        $('#accounts').append(
          '<div style="display:inline-block"><input name="accounts" type="radio" value="' + index + '"' + 
          (index == selected ? ' checked ' : '') + '/><span>' + index + ':</span></div>'
          + '<pre style="display:inline-block;margin: 0 0 0 1em">' + account + '</pre><br>'
        )
        web3.eth.getBalance(account,
          (error, balance) => {
            if (log(error)) return
            balance = balance.toString().replace(/(\...).*e\+/, "$1^e")
            $('#accounts pre')[index].innerHTML += ' ' + balance + ' ТРЕ'
            web3.personal.unlockAccount(account, '', 0,
              (error, balance) => {
                if (log(error)) return
                $('#accounts pre')[index].innerHTML += ' unlocked'
              })
          })
      })
      $('input[name=accounts]').change((event) => {
        selected = parseInt(event.target.value)
      })
      $('#accounts span').click((event) => {
        $(event.target.previousSibling).click()
      })
      $('#accounts').css('display', 'block')
    })
})

$('#compile').click(() => {
  window.source = window.editor.getValue()
  window.result = window.solc.compile(source, 1)
  if (log(result.errors)) return
  var names = Object.keys(result.contracts).map(n => n.slice(1))
  names.sort((a, b) =>
      source.search('contract ' + a) -
      source.search('contract ' + b))
  window.name = names[names.length - 1]
  log('Compiled ' + name)
  $('span.name').text(name)
  document.title = 'Masterchain ' + name
  window.bytecode = result.contracts[':' + name].bytecode
  window.interface = JSON.parse(result.contracts[':' + name].interface)
  var content = bytecode.slice(0, 128).
    replace(/(..)/g, (_, byte) => byte + ' ')
  content += '... (' + bytecode.length / 2 + ' bytes)'
  $('#bytecode .content').text(content)
  $('#bytecode').css('display', 'block')
  var hrefAddress = location.href.search('#') + 1
  hrefAddress = hrefAddress ? location.href.slice(hrefAddress) : ''
  window.address = window.address ? '' : hrefAddress
  $('#contract input[name="address"]').val(address)
  $('#contract').css('display', 'block')
  if (address)
    setTimeout(() => $('#open').click(), 1000)
})

$('#deploy').click(() => {
  var contract = web3.eth.contract(interface)
  var txBody = {from: accounts[selected], gas: 4e6, data: '0x' + bytecode}
  var handle = 0
  contract.new(txBody, (error, result) => {
    if (log(error) || handle) return
    var txHash = result.transactionHash
    handle = setInterval(() => {
      web3.eth.getTransactionReceipt(txHash, (error, receipt) => {
        if (receipt && receipt.contractAddress) {
          window.clearInterval(handle)
          window.address = receipt.contractAddress
          log('Deployed ' + name + ' at ' + address)
          $('#contract input[name="address"]').val(address)
          setTimeout(() => $('#open').click(), 1000)
        }
      })
    }, 1000)
  })
})

$('#open').click(() => {
  window.contract = web3.eth.contract(interface)
  window.instance = contract.at(window.address)
  window.methods = interface.filter((i) => i.name)
  var slicedSource = source.slice(source.search('contract ' + name))
  for (i in methods) {
    prefix = methods[i].constant ? 'public ' : 'function '
    methods[i].order = slicedSource.search(prefix + methods[i].name)
  }
  methods.sort((a, b) => a.order - b.order)
  $('#interface').empty()
  methods.forEach((method) => {
    var form = $('<form class="card-panel" action="#">')
    var params = method.inputs.map(
      (input, i) => input.name || 'x' + (i+1)).join(', ')
    form.append(name + '.' + method.name + '(' + params + '):')
    form.append('<span id="' + method.name + '_value"></span>')
    form.attr('name', method.name)
    method.inputs.forEach((input, i) => {
      var name = input.type + ' ' + (input.name || 'x' + (i+1))
      form.append('<br><label for="' + name + '">' + name + '</label>')
      form.append('<input name="' + name + '" type="text" />')
    })
    if (method.constant) {
      if (method.inputs.length == 0) {
        $('#interface').append(form)
        instance[method.name].call((error, result) =>
          $('#' + method.name + '_value').text(
            (error || '') + ' ' + result)
        )
      } else {
        form.append('<br><a id="' + method.name + '_call" ' +
          'class="waves-effect waves-light btn">Run' +
          '<i class="material-icons right">play_arrow</i></a>')
        $('#interface').append(form)
        var thisForm = 'form[name=' + method.name + ']'
        $('#' + method.name + '_call').click(() => {
          args = $(thisForm + ' input[type=text]').map((i, a) => a.value)
          args.push((error, result) =>
            $('#' + method.name + '_value').text(
              (error || '') + ' ' + result.c[0])
          )
          instance[method.name].call(...args)
        })
      }
    } else {
      form.append('<br><a id="' + method.name + '_send" ' +
        'class="waves-effect waves-light btn">Run' +
        '<i class="material-icons right">play_arrow</i></a>')
      $('#interface').append(form)
      var thisForm = 'form[name=' + method.name + ']'
      $('#' + method.name + '_send').click(() => {
        $('#' + method.name + '_value').text('pending')
        var args = $(thisForm + ' input[type=text]').map(
          (i, a) => {
            if (method.inputs[i].type == 'address') {
              if (/0x[0-9a-z]{40}/.test(a.value))
                return a.value
              else {
                log(a.value + 'must be an address') 
                return ''
              }
            } else if (method.inputs[i].type == 'uint256') {
              if (parseInt(a.value).toString() == a.value)
                return parseInt(a.value)
              else {
                log(a.value + 'must be an integer') 
                return ''
              }
            } else if (method.inputs[i].type == 'bool') {
              if (a.value == 'true')
                return true
              else {
                if (a.value != false)
                  log(a.value + 'must be true or false')
                return false
              }
            } else return a.value
          })
        args.push({from: accounts[selected], gas: 4e6})
        args.push((error, txHash) => {
          if (log(error) || !txHash) return
          var handle = setInterval(() => {
            web3.eth.getTransactionReceipt(txHash, (error, receipt) => {
              if (log(error) || (receipt && receipt.status == '0x0')) {
                $('#' + method.name + '_value').text('failure')
                window.clearInterval(handle)
              } else if (receipt) {
                $('#' + method.name + '_value').text('success')
                window.clearInterval(handle)
              }
            })
          }, 1000)
        })
        console.log(args)
        instance[method.name](...args)
      })
    }
  })
  $('#interface').css('display', 'block')
  $('#editor').css('height', $('body').height())
  window.editor.resize()
})
