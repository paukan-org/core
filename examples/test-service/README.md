Тестовый сервис (может служить примером создания сервисов и для тестирования).
Каждую минуту увеличивает счетчик на единицу и сообщает об этом в сеть.

Доступные состояния:
1) counter - при запросе без параметров возвращает текущее состояние счетчика, при попытке передать параметр ругается "action not supported".

2) delay - при запросе без параметров ругается возвращает текущее состояние интервала между изменениями счетчика, при передаче числа изменяет интервал на это число.
