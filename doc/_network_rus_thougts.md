Сеть (network) - общая шина общения для сервисов и устройств автоматизации.

Сервис (service) - интерфейс взаимодействия между устройствами и сетью. Реагирует на события сети,
передает команды устройствам и события от них в сеть.

Устройство (device) - отображение физического устройства или логической процедуры в системе.
Общается только с сервисом и не знает ничего о сети.



Типы событий:

state.[servicename].[devicename].[statename] - событие от устройства об изменении состояния
первым параметром должно быть новое состояние, вторым старое (необязательно)

- state.ups.rapsbery.power [100, 99]

request.[servicename].[devicename].[statename] - получить текущее состояние от устройства
должен передаваться параметр в который посылать ответ (если не передан - reply не возвращается)
- request.ups.raspbery.power [uniqueid|null] = > reply.ups.[uniqued].power [err|null, 100]

request.[servicename].[devicename].[statename] - установить состояние устройства
- request.scenario.alloff.active [uniqueid|null, true]

reply.[servicename].[uniqid|devicename].[action] - ответ устройства на request событие
первым параметром ответа всегда идет null или ошибка, вторым овтет




Зарезервированые слова:
[servicename]: global (зарезервировано для управляющего канала)
[devicename]: service (зарезервировано для сервисов)
[statename]: online, offline, ping, discover



Работающий сервис должен всегда:

1) отвечать на события типа global:
- request.global.anystring.discover [uniqid]- предоставить информацию о своем окружении в формате:
reply.[servicename].[uqniqid].discover содержащим два параметра:
1й: ошибку или null
2й: объект с инфопакетом по сервису и устройствам:
{
  info
  devices: [ info1, info2 ]
}

{
  id: 'x', // required
  name: 'y', // required
  version: 'z', // required for service
  about: 'a', // required for service
  link: 'b', // required for service
  states: {
    state1: 'val1',
    state2: 'val2'
  },
  actions: {
    action1: 'val1',
    action2: 'val2'
  }
}


- request.global.anystring.ping [uniqid]- ответить reply.[servicename].[uniqueid].pong

2) послать 'online' при своем запуске и запуске устройств, 'offline' при своем выключении
или выключении устройств

3) стараться быть максимально независимым от остальных сервисов и допускать минимальные задержки при ответах
