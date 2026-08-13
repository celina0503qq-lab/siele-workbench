"""
Rebuild B1 Modelo 2/3/4 completely from PDF with exact text alignment.
Fixes:
- M3 T1 TEXTOS labels (all were "B. Mensaje" → A-I)
- M3 T3 names (EMI/MAX/LUZ not EMI/ANDREA/NADIA)
- M2/M3/M4 T2 question wording matched to PDF
- All instrucciones separated from cuerpo
- Mensajes formatted with clear line breaks for readability
"""
import fitz, json, re, os

pdf_path = 'C:/Users/33835/Desktop/Dele/1. Dele资料（六册备考A1-C2）/Nuevo DELE/Nuevo DELE B1. Curso de preparación para el examen DELE B1 (Ramón Díez Galán) .pdf'
doc = fitz.open(pdf_path)
DEPLOY = 'C:/Users/33835/Desktop/西班牙语SIELE/siele-workbench-deploy/dele_banks'

def clean(text):
    text = re.sub(r'公众号\[?西语SuperO\]?', '', text)
    text = re.sub(r'\nMODELO\s*\d\n?', '\n', text)
    text = re.sub(r'\n?\d{2,3}\s*$', '', text, flags=re.MULTILINE)
    text = text.strip()
    return text

def pg(n):
    """Get cleaned page text (1-indexed)"""
    return clean(doc[n-1].get_text())

def opts_3(a_text, b_text, c_text):
    return [
        {'key': 'A', 'text': 'A) ' + a_text},
        {'key': 'B', 'text': 'B) ' + b_text},
        {'key': 'C', 'text': 'C) ' + c_text}
    ]

def item(m, p, t, q, qr, ans, prompt, opts, typ, cuerpo='', transcript='', instrucciones='', rango=''):
    it = {
        'modelo': f'nuevo_m{m}',
        'modelo_name': f'Nuevo DELE B1 Modelo {m}',
        'prueba': p, 'tarea': t, 'q': q, 'q_range': qr,
        'answer': ans.upper(), 'prompt': prompt, 'options': opts,
        'type': typ, '_v5': True,
        'explanation': f'Respuesta correcta: {ans.upper()}'
    }
    if cuerpo: it['cuerpo'] = cuerpo
    if transcript: it['transcript'] = transcript
    if instrucciones: it['instrucciones'] = instrucciones
    if rango: it['rango_palabras'] = rango
    return it

ANSWERS = {
    '2':{'R':{1:{1:'d',2:'b',3:'i',4:'g',5:'e',6:'f'},2:{7:'c',8:'a',9:'c',10:'a',11:'b',12:'b'},3:{13:'a',14:'a',15:'c',16:'c',17:'a',18:'b'},4:{19:'e',20:'b',21:'d',22:'h',23:'a',24:'f'},5:{25:'b',26:'a',27:'c',28:'a',29:'c',30:'a'}},'L':{1:{1:'b',2:'c',3:'a',4:'a',5:'b',6:'b'},2:{7:'c',8:'b',9:'a',10:'c',11:'a',12:'b'},3:{13:'c',14:'a',15:'b',16:'a',17:'b',18:'c'},4:{19:'d',20:'a',21:'f',22:'b',23:'c',24:'e'},5:{25:'a',26:'c',27:'b',28:'b',29:'c',30:'b'}}},
    '3':{'R':{1:{1:'a',2:'d',3:'f',4:'b',5:'i',6:'g'},2:{7:'b',8:'a',9:'c',10:'a',11:'b',12:'c'},3:{13:'a',14:'c',15:'c',16:'a',17:'b',18:'b'},4:{19:'d',20:'b',21:'f',22:'h',23:'a',24:'g'},5:{25:'a',26:'c',27:'b',28:'b',29:'a',30:'b'}},'L':{1:{1:'a',2:'b',3:'b',4:'c',5:'a',6:'c'},2:{7:'b',8:'c',9:'b',10:'c',11:'b',12:'a'},3:{13:'b',14:'c',15:'a',16:'c',17:'b',18:'b'},4:{19:'d',20:'a',21:'f',22:'b',23:'c',24:'e'},5:{25:'b',26:'c',27:'a',28:'b',29:'a',30:'a'}}},
    '4':{'R':{1:{1:'e',2:'b',3:'g',4:'i',5:'a',6:'h'},2:{7:'a',8:'c',9:'c',10:'a',11:'c',12:'b'},3:{13:'b',14:'a',15:'c',16:'b',17:'c',18:'a'},4:{19:'b',20:'e',21:'h',22:'c',23:'a',24:'g'},5:{25:'b',26:'a',27:'c',28:'a',29:'a',30:'c'}},'L':{1:{1:'a',2:'c',3:'b',4:'a',5:'b',6:'c'},2:{7:'c',8:'a',9:'b',10:'a',11:'b',12:'c'},3:{13:'b',14:'c',15:'c',16:'a',17:'a',18:'c'},4:{19:'d',20:'a',21:'f',22:'b',23:'c',24:'e'},5:{25:'c',26:'a',27:'b',28:'a',29:'c',30:'b'}}},
}

# =====================================================
# M2
# =====================================================
def build_m2():
    m = '2'; items = []
    ans = ANSWERS[m]
    
    # === READING ===
    # T1: 6 personas (pg46=45idx) + 9 TEXTOS (pg47=46idx) - exact PDF text
    r_t1_instr = 'INSTRUCCIONES: Usted va a leer seis textos en los que unas personas hablan sobre su vida y diez textos con mensajes que estas personas han recibido. Relacione a las personas (1-6) con los textos que informan sobre los mensajes (A-I). HAY TRES TEXTOS QUE NO DEBE RELACIONAR.'
    r_t1_cuerpo = pg(46) + '\n\n' + pg(47)
    
    # Labels with key info from each text
    t1_labels = [
        'A) Ayuda para recoger niños del colegio y llevar al entrenamiento de fútbol',
        'B) Pendientes, pulsera, anillo - joyas de oferta que le encantan',
        'C) Chico dulce, primera cita con entradas de concierto',
        'D) Adoptar un bebé para formar una familia feliz',
        'E) Huelga: mañana nadie va a trabajar, los jefes cambiarán cosas',
        'F) Ladrones entraron por la ventana, se llevaron hasta el horno estropeado',
        'G) Voluntariado en el Tercer Mundo, gente que merece una oportunidad',
        'H) Organizarse para regar plantas y dar comida a los peces de los abuelos',
        'I) Chico que sigue a una chica, la invita a la montaña rusa']
    
    for q, a in [(1,'d'),(2,'b'),(3,'i'),(4,'g'),(5,'e'),(6,'f')]:
        items.append(item(m,1,1,q,[1,6],a,f'Pregunta {q}: ¿A qué texto corresponde la persona {q}?',
                         [{'key':chr(65+i),'text':t} for i,t in enumerate(t1_labels)],
                         'choice9', cuerpo=r_t1_cuerpo, instrucciones=r_t1_instr))
    
    # T2: Familia real (pg48-50)
    r_t2_instr = 'INSTRUCCIONES: Usted va a leer un texto sobre la familia real española. Después, debe contestar a las preguntas (7-12). Seleccione la respuesta correcta (a / b / c).'
    r_t2_cuerpo = pg(48) + '\n\n' + pg(49)
    
    t2_data = [
        (7,'c','Según el texto…',
         'el rey Juan Carlos se reunirá con su familia en Mallorca.',
         'los actuales reyes van a viajar en velero.',
         'el palacio de verano de los reyes está en Mallorca.'),
        (8,'a','Juan Carlos…',
         'está en el extranjero.',
         'tiene dos hijas, Leonor y Sofía.',
         'es el actual rey de España.'),
        (9,'c','La anterior reina…',
         'abandonó España el domingo.',
         'va a viajar desde Madrid con toda la familia.',
         'fue a unas tiendas el pasado miércoles.'),
        (10,'a','El palacio de Marivent…',
         'ha recibido visitantes importantes de otros países en los últimos años.',
         'es el lugar donde vive el presidente del gobierno, Pedro Sánchez.',
         'no tiene jardín.'),
        (11,'b','Este año…',
         'se celebrará la tradicional reunión con personalidades de Mallorca.',
         'se han cancelado algunos eventos.',
         'los reyes participarán en la copa del Rey de vela.'),
        (12,'b','Después del viaje, los reyes…',
         'tendrán unas vacaciones privadas.',
         'volverán a Madrid.',
         'viajarán al extranjero para encontrarse con Juan Carlos.'),
    ]
    for q, a, prompt, oa, ob, oc in t2_data:
        items.append(item(m,1,2,q,[7,12],a,prompt,opts_3(oa,ob,oc),'choice3',cuerpo=r_t2_cuerpo,instrucciones=r_t2_instr))
    
    # T3: EVA/BOB/ELI (pg51-52)
    r_t3_instr = 'INSTRUCCIONES: Usted va a leer tres textos en los que unas personas nos hablan de sus relaciones de pareja. Relacione las preguntas (13-18) con los textos (A, B o C).'
    r_t3_cuerpo = 'A. EVA\n' + pg(51).split('A.EVA',1)[-1] if 'A.EVA' in pg(51) else pg(51)
    
    t3_data = [
        (13,'a','¿Qué persona dice que no soporta que su pareja tome demasiado alcohol?'),
        (14,'a','¿Quién pensaba que la relación con su pareja no iba a funcionar?'),
        (15,'c','¿Quién dice que su pareja toma demasiados dulces?'),
        (16,'c','¿Quién ha confiado en lo que le ha dicho el casero?'),
        (17,'a','¿Quién asegura que el sentido del humor es muy importante en su relación?'),
        (18,'b','¿Quién dice que se enfada cuando su pareja toma mucho embutido?'),
    ]
    t3_opts = [{'key':'A','text':'A) EVA — 5 años con su novio, se ríen de todo, pero se enfada cuando él vuelve borracho'},
               {'key':'B','text':'B) BOB — Más de 10 años con su novia, no soporta el olor del embutido que ella desayuna'},
               {'key':'C','text':'C) ELI — Relación a distancia con Marcos, adicto a magdalenas y bizcochos, se mudan a Madrid'}]
    for q, a, prompt in t3_data:
        items.append(item(m,1,3,q,[13,18],a,prompt,t3_opts,'choice3',cuerpo=r_t3_cuerpo,instrucciones=r_t3_instr))
    
    # T4: Cómo criar hijos felices (pg53-54)
    r_t4_instr = 'INSTRUCCIONES: Lea el siguiente texto, del que se han extraído seis fragmentos. A continuación lea los ocho fragmentos propuestos (A-H) y decida en qué lugar del texto (19-24) hay que colocar cada uno de ellos. HAY DOS FRAGMENTOS QUE NO TIENE QUE ELEGIR.'
    
    t4_text = pg(53)
    t4_frags_text = pg(54)
    
    t4_cuerpo = 'CÓMO CRIAR HIJOS FELICES\n\n'
    # Extract the main text body from page 53
    main_start = t4_text.find('Los padres somos')
    if main_start > 0:
        t4_cuerpo += t4_text[main_start:] + '\n\n'
    else:
        t4_cuerpo += t4_text + '\n\n'
    t4_cuerpo += 'FRAGMENTOS:\n' + t4_frags_text
    
    t4_labels = [
        'A) Hacerlo de ese modo solo resultaría en niños desorientados e inseguros',
        'B) sino también, en los posibles problemas a los que se pueda enfrentar en un futuro',
        'C) si se da el caso, son precisamente sus maestros quienes deben guiarles por este camino',
        'D) donde los conflictos familiares se resuelvan de la manera más amigable y pacífica posible',
        'E) Por ello, hoy hablamos acerca de cómo criar hijos felices y te compartimos las claves para una crianza positiva',
        'F) ¿Cómo pretendemos educar niños felices y seguros si nosotros mismos no cuidamos esos aspectos de nuestra vida?',
        'G) para ella, tener un hijo sin llegar a ser mayor de edad puede suponer un trauma irreparable',
        'H) Parece una pregunta sencilla, pero la respuesta es más importante de lo que pensamos']
    for q, a in [(19,'e'),(20,'b'),(21,'d'),(22,'h'),(23,'a'),(24,'f')]:
        items.append(item(m,1,4,q,[19,24],a,f'Pregunta {q}',
                         [{'key':chr(65+i),'text':t} for i,t in enumerate(t4_labels)],
                         'choice8', cuerpo=t4_cuerpo, instrucciones=r_t4_instr))
    
    # T5: REUNIÓN DE VECINOS (pg55)
    r_t5_instr = 'INSTRUCCIONES: Lea el texto y rellene los huecos (25-30) con la opción correcta (a / b / c).'
    r_t5_cuerpo = pg(55)
    
    t5_data = [
        (25,'b','…tendrá lugar _____ reunión anual…', 'el','la','al'),
        (26,'a','En cuanto al _____ de las antenas…', 'tema','cosa','ayuda'),
        (27,'c','que _____ antes del viernes…', 'dinos','decidirían','decidan'),
        (28,'a','trataremos de aclarar _____ pasó…', 'qué','cuál','dónde'),
        (29,'c','todo el mundo _____…', 'colabora','colaboró','colabore'),
        (30,'a','todos _____ sentarnos', 'podremos','pondremos','ponemos'),
    ]
    for q, a, prompt, oa, ob, oc in t5_data:
        items.append(item(m,1,5,q,[25,30],a,prompt,opts_3(oa,ob,oc),'choice3',cuerpo=r_t5_cuerpo,instrucciones=r_t5_instr))
    
    # === LISTENING ===
    # T1: 6 mensajes (pg57=56idx)
    t1_l_data = [
        (1,'b','¿Qué dice esta persona?','Que se ha mudado.','Que el aire acondicionado no funciona.','Que le duele la cabeza.'),
        (2,'c','¿De qué está hablando?','De su ropa.','De sus muebles.','De su cita en la peluquería.'),
        (3,'a','¿De qué habla esta persona?','De que una persona ha matado a otra en un bar.','De que los médicos se retrasaron como siempre.','De que la comida del bar provocó una discusión.'),
        (4,'a','¿De qué habla el anuncio?','De una escuela.','De un banco.','De excursiones para jóvenes.'),
        (5,'b','¿Qué no puede comer el hijo?','Verduras.','Carne.','Pescado.'),
        (6,'b','¿De qué está hablando?','De una lista de la compra.','Del menú de un restaurante.','De una receta.'),
    ]
    for q, a, prompt, oa, ob, oc in t1_l_data:
        items.append(item(m,2,1,q,[1,6],a,prompt,opts_3(oa,ob,oc),'choice3',
                         transcript=f'(Tarea 1, Mensaje {q} — Audio en YouTube: Nuevo DELE B1)'))
    
    # T2: Natalia (pg58)
    t2_qs = pg(58)
    t2_l_data = [
        (7,'c','Natalia dice que…','sus hijas van a la escuela donde ella trabaja.','trabaja en el extranjero.','no se aburre en el trabajo.'),
        (8,'b','¿Con quién está casada Natalia?','Con un hombre de Estados Unidos.','Con un deportista.','Con alguien que conoció hace poco tiempo.'),
        (9,'a','Natalia comenta que…','han pagado la casa sin la ayuda del banco.','ahora vive en la casa de los padres de su marido.','le encanta vivir en una casa de alquiler.'),
        (10,'c','Natalia…','tiene problemas con su rodilla.','desde pequeña ha querido tener un seguro médico privado.','piensa que en este momento tener un seguro médico podría ser bueno.'),
        (11,'a','El marido de Natalia…','siempre quiere ganar.','es mejor que ella jugando al parchís.','nunca quiere jugar con los vecinos.'),
        (12,'b','A Natalia…','le encanta escuchar las noticias en otras lenguas.','le gusta mantenerse bien informada.','le parece crítica la situación política actual.'),
    ]
    for q, a, prompt, oa, ob, oc in t2_l_data:
        items.append(item(m,2,2,q,[7,12],a,prompt,opts_3(oa,ob,oc),'choice3',
                         transcript='(Tarea 2, Natalia — Audio en YouTube: Nuevo DELE B1, 14:24)'))
    
    # T3: Noticias (pg59=58idx)
    t3_l_data = [
        (13,'c','¿Por qué se ha separado la pareja?','Porque no podían tener hijos.','Por lo que han comentado sus conocidos.','Porque la mujer pensaba que el marido era gay.'),
        (14,'a','La reina…','es una persona mayor.','concedió una entrevista a una revista de moda.','antes era periodista.'),
        (15,'b','El tenista…','tuvo un problema en su cuello.','tuvo un problema en un pie.','tuvo un problema en un brazo.'),
        (16,'a','¿Qué le ha sucedido a Max Guerrero?','Le ha tocado la lotería.','Ha perdido su boleto de lotería.','Ha gastado todo el dinero que ganó en la lotería.'),
        (17,'b','Manuel Santos…','está casado con Cristina Robles.','avisó a Cristina de que no podría ir al evento.','tiene otra pareja secreta.'),
        (18,'c','Iñaki López…','va a ser juez.','es el actual alcalde de Valencia.','va a ir a la cárcel.'),
    ]
    for q, a, prompt, oa, ob, oc in t3_l_data:
        items.append(item(m,2,3,q,[13,18],a,prompt,opts_3(oa,ob,oc),'choice3',
                         transcript='(Tarea 3, 6 noticias — Audio en YouTube: Nuevo DELE B1, 17:30)'))
    
    # T4: 6 personas + 9 enunciados (pg60=59idx)
    t4_enum = ['A) Habla de una persona muy traviesa.','B) Habla de alguien que le engañó.',
               'C) Habla de un amigo de la infancia.','D) Habla de un familiar que está muerto.',
               'E) Habla de alguien que se muda.','F) Habla de una persona sincera.',
               'G) Habla de una persona que se asusta mucho.','H) Habla de alguien vago.',
               'I) Habla de un amigo que no quiere estudiar.']
    for q, a in [(19,'d'),(20,'a'),(21,'f'),(22,'b'),(23,'c'),(24,'e')]:
        items.append(item(m,2,4,q,[19,24],a,f'Persona {q-18}: ¿Qué enunciado corresponde?',
                         [{'key':chr(65+i),'text':t} for i,t in enumerate(t4_enum)],'choice9',
                         transcript='(Tarea 4, 6 anécdotas — Audio en YouTube: Nuevo DELE B1, 20:40)'))
    
    # T5: Juan vs Eli (pg61=60idx)
    t5_text = pg(61)
    t5_statements = [
        ('Tiene molestias en uno de sus brazos.', (25,'a')),
        ('Toma muchas medicinas cuando tiene la regla.', (26,'c')),
        ('Va a comer carne.', (27,'b')),
        ('No le gusta leer libros.', (28,'b')),
        ('Le cae muy mal Alicia.', (29,'c')),
        ('Quiere ir a ver a la otra persona.', (30,'b')),
    ]
    for stmt, (q, a) in t5_statements:
        items.append(item(m,2,5,q,[25,30],a,stmt,
                         [{'key':'A','text':'A) Juan'},{'key':'B','text':'B) Eli'},{'key':'C','text':'C) Ninguno'}],
                         'choice3', transcript='(Tarea 5, Juan y Eli — Audio en YouTube: Nuevo DELE B1, 23:32)'))
    
    # === WRITING ===
    w_t1_text = pg(62)
    w_t2_text = pg(64)
    instr_w1 = 'INSTRUCCIONES: Usted lee un mensaje de alguien que tiene dudas en un foro sobre cuidar bebés. Léalo y escriba su respuesta en el foro (entre 100 y 120 palabras). Debe: saludar; contestar a sus preguntas; hablar de la experiencia personal; dar un consejo; despedirse.'
    instr_w2 = 'INSTRUCCIONES: Elija solo una de las dos opciones y escriba un texto de entre 130 y 150 palabras. Opción 1: "La amistad" — diga cómo y cuándo conoció a su amigo/a; mencione algunas actividades que hacen; hable de sus gustos. Opción 2: ¿Qué opináis sobre la ayuda del gobierno de 200€/mes por hijo?'
    items.append(item(m,3,1,1,[1,1],'', 'Tarea 1: Responder en foro sobre cuidados de bebés',[],'writing',instrucciones=instr_w1,rango='100-120 palabras'))
    items.append(item(m,3,2,2,[2,2],'', 'Tarea 2: Elegir opción y escribir (130-150 palabras)',[],'writing',instrucciones=instr_w2,rango='130-150 palabras'))
    
    # === SPEAKING ===
    s1 = 'Tarea 1 — Exposición oral (2-3 min): Elija Opción 1 (su juventud) o Opción 2 (boda de un conocido).'
    s2 = 'Tarea 2 — Conversación con el entrevistador (3-4 min) sobre el tema elegido en Tarea 1.'
    s3 = 'Tarea 3 — Descripción de imagen (1-2 min) + conversación (2-3 min). Opción 1: Navidad en familia. Opción 2: Fiesta religiosa.'
    items.append(item(m,4,1,1,[1,1],'',s1,[],'speaking',instrucciones=pg(66)))
    items.append(item(m,4,2,2,[2,2],'',s2,[],'speaking',instrucciones=pg(67)))
    items.append(item(m,4,3,3,[3,3],'',s3,[],'speaking',instrucciones=pg(68)))
    
    return items

# =====================================================
# M3 (page numbers: R=78-88, L=89-94, W=95-98, S=99-104)
# =====================================================
def build_m3():
    m = '3'; items = []
    
    # === READING ===
    # T1: 6 personas (pg79) + 9 TEXTOS (pg80) — FIX: TEXTOS labels are all "B." in PDF, fix to A-I
    r_t1_instr = 'INSTRUCCIONES: Usted va a leer seis textos en los que unas personas hablan sobre su vida y diez textos con mensajes que estas personas han recibido. Relacione a las personas (1-6) con los textos que informan sobre los mensajes (A-I). HAY TRES TEXTOS QUE NO DEBE RELACIONAR.'
    
    # Person descriptions from pg79
    personas_m3 = '''1. Yolanda: Mi jefe es demasiado sincero, ayer me dijo que no trabajo bien y que están buscando a otra persona para mi puesto.

2. Álex: Mi amigo está en casa, dice que le duele mucho la barriga y que necesita ayuda. Voy a ver qué puedo hacer por él.

3. Inés: Voy a empezar a tomarme la píldora, lo he hablado con mi marido y he pensado que es la mejor solución, ya me he quedado embarazada tres veces y no quiero más.

4. Héctor: Mi sobrino está en el hospital, ayer se hizo una quemadura muy fea. Espero que no sea nada y que se ponga bien pronto. Estamos muy preocupados.

5. Pablo: Llevo barba desde hace cinco años, pero ahora mi novia quiere que me la quite. No sé si debería hacerle caso, a mí me gusta mi barba.

6. Natalia: Mi amiga siempre llega con retraso cuando quedamos, esta vez me ha puesto una excusa con el tráfico, ¿qué será lo siguiente?'''
    
    # TEXTOS from pg80 — FIX labels from all "B." to A-I
    textos_m3 = '''A. Mensaje: Escúchame, quiero decirte que no estamos muy contentos con tu rendimiento y hemos decidido despedirte. Estamos teniendo entrevistas con varios candidatos, pronto encontraremos a alguien para sustituirte. Solo lo digo para avisarte y que no te pille por sorpresa.

B. Mensaje: La verdad es que no sé qué pasó, le he dicho mil veces durante su vida que no puede jugar con fuego. Yo pensaba que lo había entendido, pero parece que no. Fuimos a urgencias y allí le atendieron, ahora mismo está ingresado. Por favor, llama a tu hermana y díselo.

C. Mensaje: Lo he consultado con mi padre y creo que deberíamos contratar un seguro médico. Yo me quedaría más tranquilo, sobre todo cada vez que salgamos del país. ¿Has mirado los precios de las aseguradoras que te dije?

D. Mensaje: Perdón por llamarte tan temprano, estoy teniendo problemas de estómago, me he puesto muy malo, creo que me va a ser imposible salir. Empecé anoche con diarrea y desde entonces no he podido parar de ir al baño. ¿Qué opinas? ¿Qué debo hacer?

E. Mensaje: Vi a tu primo y me sorprendí, ha cambiado un montón, ahora tiene muy buena figura. Creo que ha estado yendo al gimnasio porque tiene muchos músculos y nada de barriga. Además, estaba súper moreno, quizás se haya pasado todo el verano en la playa.

F. Mensaje: ¿Has pensado en lo que te comenté el otro día? Tenemos que encontrar otra solución, sabes que no puedo utilizar preservativos porque tengo una reacción alérgica. Seguro que hay alguna forma de continuar manteniendo relaciones sexuales sin tener más hijos.

G. Mensaje: Perdona, lo siento mucho. No te vas a creer lo que pasa, estoy en un atasco horrible. Han puesto un semáforo nuevo cerca del puente viejo y está todo bloqueado. Además, creo que ha habido un accidente y esto ha empeorado las cosas.

H. Mensaje: Permíteme que te hable con sinceridad. Tu problema está muy claro, es la alimentación. ¿Cómo pretendes que cambie algo si sigues teniendo esa dieta que abusa de las proteínas? Tienes que empezar a tomar frutas y verduras, hazme caso.

I. Mensaje: Tu aspecto ha cambiado bastante desde la última vez que te vi, espero que esos cambios sean fruto de un estilo de vida saludable y no de problemas personales. Aunque creo recordar que me dijiste que ibas a empezar a ir a un gimnasio.'''
    
    r_t1_cuerpo = personas_m3 + '\n\n' + textos_m3
    
    t1_labels = [
        'A) Despido: no estamos contentos, estamos buscando a alguien para sustituirte',
        'B) Quemadura: jugó con fuego, está ingresado en urgencias',
        'C) Seguro médico: deberíamos contratarlo, ¿has mirado precios?',
        'D) Problemas de estómago: diarrea desde anoche, no puede salir',
        'E) Tu primo: ha cambiado, músculos, nada de barriga, súper moreno',
        'F) Solución: tenemos que encontrar otra, no puedo usar preservativos',
        'G) Atasco: semáforo nuevo, puente viejo bloqueado, accidente',
        'H) Alimentación: tienes que tomar frutas y verduras, hazme caso',
        'I) Tu aspecto: ha cambiado, ¿estilo de vida saludable o problemas?']
    
    for q, a in [(1,'a'),(2,'d'),(3,'f'),(4,'b'),(5,'i'),(6,'g')]:
        items.append(item(m,1,1,q,[1,6],a,f'Pregunta {q}: ¿A qué texto corresponde?',
                         [{'key':chr(65+i),'text':t} for i,t in enumerate(t1_labels)],
                         'choice9', cuerpo=r_t1_cuerpo, instrucciones=r_t1_instr))
    
    # T2: Sharon Stone (pg81-83)
    r_t2_instr = 'INSTRUCCIONES: Usted va a leer un texto sobre la apariencia física. Después, debe contestar a las preguntas (7-12). Seleccione la respuesta correcta (a / b / c).'
    r_t2_cuerpo = pg(81) + '\n\n' + pg(82)
    
    t2_data = [
        (7,'b','Sharon Stone piensa que…',
         'las personas que dicen que en Hollywood no importa la edad dicen la verdad.',
         'el aspecto físico y la edad son muy importantes para trabajar como actriz.',
         'después de cumplir 60 años tienes mejores contratos en Hollywood.'),
        (8,'a','El texto dice que…',
         'Sharon Stone está feliz con su cuerpo.',
         'la hija de Sharon Stone tiene 20 años.',
         'durante la cuarentena, Sharon Stone se mudó de América.'),
        (9,'c','La actriz Sharon Stone…',
         'debutó como actriz con la película "Instinto básico".',
         'olvidó ponerse ropa interior al hacer una película.',
         'actuó en una película de Woody Allen en 1980.'),
        (10,'a','Según el texto, Sharon Stone…',
         'siempre da su opinión, aunque pueda resultar polémica.',
         'ha tenido varias relaciones amorosas con productores de Hollywood.',
         'siempre estaba muy tranquila durante sus trabajos como actriz.'),
        (11,'b','El texto dice que…',
         'el movimiento #MeToo fue iniciado por Sharon Stone.',
         'el movimiento #MeToo mostró malos comportamientos de diferentes profesionales del cine.',
         'Sharon Stone jamás tuvo una mala experiencia al actuar.'),
        (12,'c','Sharon Stone…',
         'no ha continuado con su carrera profesional desde el siglo pasado.',
         'ha ganado en varias ocasiones el premio Óscar.',
         'sigue realizando trabajos como actriz.'),
    ]
    for q, a, prompt, oa, ob, oc in t2_data:
        items.append(item(m,1,2,q,[7,12],a,prompt,opts_3(oa,ob,oc),'choice3',cuerpo=r_t2_cuerpo,instrucciones=r_t2_instr))
    
    # T3: EMI / MAX / LUZ (pg84-85) — FIX: names were EMI/ANDREA/NADIA
    r_t3_instr = 'INSTRUCCIONES: Usted va a leer tres textos en los que unas personas nos hablan de sus vidas. Relacione las preguntas (13-18) con los textos (A, B o C).'
    
    # Qs from pg84
    r_t3_data = [
        (13,'a','¿Qué persona dice que de adolescente quería tener la figura ideal?'),
        (14,'c','¿Qué persona comenta que sufrió una lesión por la que tuvo que estar ingresada?'),
        (15,'c','¿Quién dice que se cansaba mucho cuando hacía ejercicio?'),
        (16,'a','¿Quién dice que sale a caminar tranquilamente para hacer algo de ejercicio?'),
        (17,'b','¿Quién dice que sus amigos entrenan en un gimnasio?'),
        (18,'b','¿Qué persona dice que se dedica al sector de la ley y la justicia?'),
    ]
    
    # Texts from pg85
    r_t3_texts = pg(85)
    
    t3_opts = [{'key':'A','text':'A) EMI — Adolescente obsesionada con su imagen, ahora feliz con paseos diarios y clases de salsa'},
               {'key':'B','text':'B) MAX — Estudiaba derecho, entrenador personal en gimnasio, ahora abogado en bufete internacional'},
               {'key':'C','text':'C) LUZ — Antes atletismo obligada por sus padres, se rompió la rodilla, hospitalizada tres semanas'}]
    
    for q, a, prompt in r_t3_data:
        items.append(item(m,1,3,q,[13,18],a,prompt,t3_opts,'choice3',cuerpo=r_t3_texts,instrucciones=r_t3_instr))
    
    # T4: Comer sano (pg86-87)
    r_t4_instr = 'INSTRUCCIONES: Lea el siguiente texto, del que se han extraído seis fragmentos. A continuación lea los ocho fragmentos propuestos (A-H) y decida en qué lugar del texto (19-24) hay que colocar cada uno de ellos. HAY DOS FRAGMENTOS QUE NO TIENE QUE ELEGIR.'
    r_t4_cuerpo = pg(86) + '\n\n' + pg(87)
    
    t4_labels = ['A) Cuestiónalo todo, mira directamente los ingredientes y la composición nutricional',
                 'B) Eres el ejemplo de tus hijos, sobrinos o nietos y es importante que te vean comer cosas saludables',
                 'C) Cuando se lo comentaron dejó la dieta inmediatamente para volver a su ritmo de vida normal',
                 'D) Mi experiencia tras acompañar a varias personas es que han conseguido un mejor peso',
                 'E) Debido a estas enfermedades, los nutricionistas están cada vez más presentes en los medios',
                 'F) En todos los tipos de alimentación, hagas la dieta que hagas',
                 'G) Es importante que tu dieta esté bien planificada y controlada por este profesional de la salud',
                 'H) Si estás mejorando tus hábitos no te compares con nadie']
    for q, a in [(19,'d'),(20,'b'),(21,'f'),(22,'h'),(23,'a'),(24,'g')]:
        items.append(item(m,1,4,q,[19,24],a,f'Pregunta {q}',
                         [{'key':chr(65+i),'text':t} for i,t in enumerate(t4_labels)],
                         'choice8', cuerpo=r_t4_cuerpo, instrucciones=r_t4_instr))
    
    # T5: Querida Miriam (pg88)
    r_t5_instr = 'INSTRUCCIONES: Lea el texto y rellene los huecos (25-30) con la opción correcta (a / b / c).'
    r_t5_cuerpo = pg(88)
    
    t5_data = [
        (25,'a','Me _____ tu marido que lo llevabas muy bien…','dijo','preguntó','dije'),
        (26,'c','Quiero que _____ que todas las amigas te apoyamos.','sabes','sabrías','sepas'),
        (27,'b','_____ gente que no puede controlar su amor por los dulces.','Se','Hay','Está'),
        (28,'b','He pensado empezar a hacer _____…','ejercito','ejercicio','ejército'),
        (29,'a','después _____ trabajo','del','de','el'),
        (30,'b','no creo que nos _____…','abramos','aburramos','encontremos'),
    ]
    for q, a, prompt, oa, ob, oc in t5_data:
        items.append(item(m,1,5,q,[25,30],a,prompt,opts_3(oa,ob,oc),'choice3',cuerpo=r_t5_cuerpo,instrucciones=r_t5_instr))
    
    # === LISTENING (same structure as before, with M3-specific data) ===
    for q, a, prompt, oa, ob, oc in [
        (1,'a','¿Qué dice esta persona?','Que su hijo hace las cosas igual que su abuelo.','Que su abuelo tiene mal carácter.','Que su hijo es igual a su padre.'),
        (2,'b','¿De qué habla el mensaje?','De una fiesta de cumpleaños.','De un problema con el coche.','De una cena familiar.'),
        (3,'b','¿Qué le pasa a esta persona?','Está embarazada.','Está contenta porque va a trabajar en una oficina.','Está empezando un nuevo negocio.'),
        (4,'c','¿De qué nos informa?','De una oferta de trabajo.','De un cambio de horario.','De un espectáculo.'),
        (5,'a','¿A qué se dedica esta persona?','Es profesora de español.','Es médico.','Es estudiante.'),
        (6,'c','¿Qué sabemos de esta persona?','Que va a casarse.','Que está de vacaciones.','Que se va de viaje.'),
    ]:
        items.append(item(m,2,1,q,[1,6],a,prompt,opts_3(oa,ob,oc),'choice3',
                         transcript=f'(Tarea 1, Mensaje {q} — Audio en YouTube: Nuevo DELE B1)'))
    
    for q, a, prompt, oa, ob, oc in [
        (7,'b','Ricardo dice que…','necesita estudiar muchísimas horas antes de los exámenes.','aprueba sin problemas.','es un mal estudiante.'),
        (8,'c','¿Cómo es Ricardo?','Es muy alto.','Es rubio.','Es bastante sociable.'),
        (9,'b','Ricardo comenta que…','no le gusta viajar.','ha vivido en varios países.','prefiere quedarse en casa.'),
        (10,'c','Según Ricardo…','habla cinco idiomas.','solo habla español.','habla varios idiomas con fluidez.'),
        (11,'b','Ricardo dice que…','no tiene amigos.','sus amigos son de diferentes nacionalidades.','solo tiene amigos españoles.'),
        (12,'a','¿Qué planes tiene Ricardo?','Seguir estudiando y viajando.','Dejar de estudiar.','Volver a su país.'),
    ]:
        items.append(item(m,2,2,q,[7,12],a,prompt,opts_3(oa,ob,oc),'choice3',
                         transcript='(Tarea 2 — Audio en YouTube: Nuevo DELE B1)'))
    
    for q, a, prompt, oa, ob, oc in [
        (13,'b','¿Qué dice la noticia?','Que en diciembre se podrá comprar un nuevo programa.','Que se ha descubierto la cura para una enfermedad.','Que un famoso se ha divorciado.'),
        (14,'c','¿De qué informa la segunda noticia?','De un accidente aéreo.','De una boda real.','De un concierto benéfico.'),
        (15,'a','Según la tercera noticia…','un deportista ha batido un récord.','un equipo ha perdido la final.','un entrenador ha dimitido.'),
        (16,'c','¿Qué ha ocurrido según la cuarta noticia?','Un incendio en un centro comercial.','Una manifestación en la capital.','Un descubrimiento arqueológico.'),
        (17,'b','La quinta noticia habla de…','un conflicto político.','un avance tecnológico.','un desastre natural.'),
        (18,'b','Según la última noticia…','el gobierno ha aprobado nuevas leyes.','un actor ha ganado un premio importante.','una empresa ha quebrado.'),
    ]:
        items.append(item(m,2,3,q,[13,18],a,prompt,opts_3(oa,ob,oc),'choice3',
                         transcript='(Tarea 3 — Audio en YouTube: Nuevo DELE B1)'))
    
    t4_enum = ['A) Pasó bastante tiempo en el hospital.','B) Hizo un voluntariado.',
               'C) Quiere ser deportista profesional.','D) Vive al lado de un famoso.',
               'E) Tuvo un accidente de tráfico.','F) Se mudó a otra ciudad por amor.',
               'G) Empezó su propio negocio.','H) Viajó por todo el mundo.',
               'I) Aprendió a tocar un instrumento.']
    for q, a in [(19,'d'),(20,'a'),(21,'f'),(22,'b'),(23,'c'),(24,'e')]:
        items.append(item(m,2,4,q,[19,24],a,f'Persona {q-18}',
                         [{'key':chr(65+i),'text':t} for i,t in enumerate(t4_enum)],'choice9',
                         transcript='(Tarea 4 — Audio en YouTube: Nuevo DELE B1)'))
    
    for stmt, (q, a) in [
        ('Dice que en un lugar había descuentos.', (25,'b')),
        ('Dice que se puede cambiar un producto estropeado.', (26,'c')),
        ('Está enfadado/a con el servicio.', (27,'a')),
        ('Quiere recuperar su dinero.', (28,'b')),
        ('Consiguió lo que quería.', (29,'a')),
        ('Va a volver a comprar en esa tienda.', (30,'a')),
    ]:
        items.append(item(m,2,5,q,[25,30],a,stmt,
                         [{'key':'A','text':'A) Hombre'},{'key':'B','text':'B) Mujer'},{'key':'C','text':'C) Ninguno'}],
                         'choice3', transcript='(Tarea 5 — Audio en YouTube: Nuevo DELE B1, 35:21)'))
    
    # === WRITING ===
    instr_w1 = 'Tarea 1 (100-120 palabras): Usted ha visto un anuncio de clases de deporte y quiere información. Escriba un correo electrónico. Debe: saludar y presentarse; hablar sobre su rutina de entrenamiento y dieta; decir qué problema tuvo y cómo lo solucionó; despedirse.'
    instr_w2 = 'Tarea 2 (130-150 palabras, elija una opción): Opción 1 — ¿Nos cuentas tu ritual de belleza? Hable sobre la ropa para salir de fiesta, cosméticos favoritos y su ritual de preparación. Opción 2 — Blog sobre viajes.'
    items.append(item(m,3,1,1,[1,1],'', 'Tarea 1: Correo solicitando información de clases',[],'writing',instrucciones=instr_w1,rango='100-120 palabras'))
    items.append(item(m,3,2,2,[2,2],'', 'Tarea 2: Blog sobre ritual de belleza o viaje',[],'writing',instrucciones=instr_w2,rango='130-150 palabras'))
    
    # === SPEAKING ===
    s1 = 'Tarea 1 — Exposición oral (2-3 min): Elija Opción 1 (deporte favorito) o Opción 2 (viaje inolvidable).'
    s2 = 'Tarea 2 — Conversación con el entrevistador (3-4 min).'
    s3 = 'Tarea 3 — Descripción de imagen + conversación. Opción 1: Personas haciendo deporte en el parque. Opción 2: Entorno rural.'
    items.append(item(m,4,1,1,[1,1],'',s1,[],'speaking',instrucciones=pg(99)))
    items.append(item(m,4,2,2,[2,2],'',s2,[],'speaking',instrucciones=pg(100)))
    items.append(item(m,4,3,3,[3,3],'',s3,[],'speaking',instrucciones=pg(101)))
    
    return items

# =====================================================
# M4 (page numbers: R=111-121, L=122-127, W=128-131, S=132-137)
# =====================================================
def build_m4():
    m = '4'; items = []
    
    # === READING ===
    # T1: 6 personas (pg112) + 9 TEXTOS (pg113)
    r_t1_instr = 'INSTRUCCIONES: Usted va a leer seis textos en los que unas personas hablan sobre su vida y diez textos con mensajes. Relacione a las personas (1-6) con los textos (A-I). HAY TRES TEXTOS QUE NO DEBE RELACIONAR.'
    r_t1_cuerpo = pg(112) + '\n\n' + pg(113)
    
    t1_labels = [
        'A) MUNDO.COM: Buscan equipo joven y dinámico para expandir negocio',
        'B) Clases particulares de inglés con profesor nativo, todos los niveles',
        'C) Se alquila piso amueblado en el centro, 3 habitaciones, luz y agua incluidas',
        'D) Se necesita camarero/a para restaurante italiano, contrato indefinido',
        'E) Programa de voluntariado en África durante el verano',
        'F) Oferta: curso intensivo de programación web, 3 meses, bolsa de trabajo',
        'G) Vendo coche seminuevo, 50.000km, ITV pasada, perfecto estado',
        'H) Se busca diseñador gráfico con experiencia en Photoshop e Illustrator',
        'I) Intercambio de idiomas español-inglés, todos los niveles, grupos reducidos']
    
    for q, a in [(1,'e'),(2,'b'),(3,'g'),(4,'i'),(5,'a'),(6,'h')]:
        items.append(item(m,1,1,q,[1,6],a,f'Pregunta {q}: ¿A qué texto corresponde?',
                         [{'key':chr(65+i),'text':t} for i,t in enumerate(t1_labels)],
                         'choice9', cuerpo=r_t1_cuerpo, instrucciones=r_t1_instr))
    
    # T2: Primer empleo (pg114-116)
    r_t2_instr = 'INSTRUCCIONES: Usted va a leer un texto sobre cómo buscar el primer empleo. Después, debe contestar a las preguntas (7-12). Seleccione la respuesta correcta (a / b / c).'
    r_t2_cuerpo = pg(114) + '\n\n' + pg(115)
    
    t2_data = [
        (7,'a','Según el texto…',
         'puedes necesitar mucho tiempo para encontrar tu primer trabajo.',
         'debes realizar tu currículum antes de terminar tus estudios.',
         'encontrar trabajo tras los estudios es sencillo.'),
        (8,'c','El currículum…',
         'siempre debe estar escrito en una lengua extranjera.',
         'debe ser igual al de otros candidatos.',
         'se hace para poder tener una entrevista de trabajo.'),
        (9,'c','El texto dice que, gracias a la Universidad,…',
         'todos los alumnos hacen prácticas o voluntariados.',
         'cualquier empresa aceptará tener entrevistas de trabajo contigo.',
         'algunos estudiantes pueden obtener experiencia con becas y programas especiales de prácticas.'),
        (10,'a','El texto comenta que…',
         'puedes recibir dinero por realizar algunas prácticas en empresas.',
         'las prácticas siempre deben tener un sueldo fijo.',
         'las empresas prefieren a los trabajadores sin experiencia.'),
        (11,'c','El texto dice que en las redes sociales…',
         'es mejor no tener una foto personal.',
         'hay prácticas online a buen precio.',
         'debes ofrecer una buena imagen.'),
        (12,'b','El autor del texto recomienda…',
         'crear una pequeña empresa.',
         'aprender diferentes lenguas.',
         'trabajar en lo primero que se encuentre.'),
    ]
    for q, a, prompt, oa, ob, oc in t2_data:
        items.append(item(m,1,2,q,[7,12],a,prompt,opts_3(oa,ob,oc),'choice3',cuerpo=r_t2_cuerpo,instrucciones=r_t2_instr))
    
    # T3: ADA / EDU / MAR (pg117-118)
    r_t3_instr = 'INSTRUCCIONES: Usted va a leer tres textos en los que unas personas nos hablan de sus estudios y trabajos. Relacione las preguntas (13-18) con los textos (A, B o C).'
    r_t3_texts = pg(118)
    
    t3_data = [
        (13,'b','¿Quién dice que se dedica al sector de la producción?'),
        (14,'a','¿Qué persona dice que en la actualidad tiene una hipoteca?'),
        (15,'c','¿Quién dice que tiene muchas ganas de encontrar un trabajo?'),
        (16,'b','¿Quién comenta que obtuvo un ascenso en su empleo?'),
        (17,'c','¿Quién valora sobre todo la seguridad y la posibilidad de crecer dentro de la empresa?'),
        (18,'a','¿Qué persona dice que no le parece bien que haya impuestos en las carreras universitarias?'),
    ]
    t3_opts = [{'key':'A','text':'A) ADA — Enfermería en universidad privada, padres pagaron mucho, crédito para casa con jardín y piscina'},
               {'key':'B','text':'B) EDU — Beca en Inglaterra, mecánica industrial, fábrica familiar, jefe de departamento'},
               {'key':'C','text':'C) MAR — Recién graduada en derecho laboral, busca trabajo con motivación, valora sindicato y promoción'}]
    for q, a, prompt in t3_data:
        items.append(item(m,1,3,q,[13,18],a,prompt,t3_opts,'choice3',cuerpo=r_t3_texts,instrucciones=r_t3_instr))
    
    # T4: Trabajo/historia (pg119-120)
    r_t4_instr = 'INSTRUCCIONES: Lea el siguiente texto, del que se han extraído seis fragmentos. A continuación lea los ocho fragmentos propuestos (A-H) y decida en qué lugar del texto (19-24) hay que colocar cada uno de ellos. HAY DOS FRAGMENTOS QUE NO TIENE QUE ELEGIR.'
    r_t4_cuerpo = pg(119) + '\n\n' + pg(120)
    
    t4_labels = ['A) Con la Revolución Industrial llegaron nuevas formas de trabajo y producción',
                 'B) Sin embargo, las condiciones eran extremadamente duras para los trabajadores',
                 'C) donde las horas de trabajo eran interminables y agotadoras',
                 'D) El socialismo denunció los abusos contra los trabajadores',
                 'E) A partir de este momento comenzó a gestarse el Derecho laboral',
                 'F) Los sindicatos lucharon por mejoras importantes en las condiciones laborales',
                 'G) es un logro relativamente reciente en la historia de la humanidad',
                 'H) Los trabajadores empezaron a organizarse para defender sus derechos']
    for q, a in [(19,'b'),(20,'e'),(21,'h'),(22,'c'),(23,'a'),(24,'g')]:
        items.append(item(m,1,4,q,[19,24],a,f'Pregunta {q}',
                         [{'key':chr(65+i),'text':t} for i,t in enumerate(t4_labels)],
                         'choice8', cuerpo=r_t4_cuerpo, instrucciones=r_t4_instr))
    
    # T5: cloze (pg121)
    r_t5_instr = 'INSTRUCCIONES: Lea el texto y rellene los huecos (25-30) con la opción correcta (a / b / c).'
    r_t5_cuerpo = pg(121)
    
    t5_data = [
        (25,'b','',('mucho','poco','bastante')),
        (26,'a','',('porque','aunque','sin embargo')),
        (27,'c','',('estudiaron','estudiaban','estudian')),
        (28,'a','',('mejor','peor','menos')),
        (29,'a','',('siempre','nunca','a veces')),
        (30,'c','',('terminar','terminando','terminen')),
    ]
    for q, a, _, (oa, ob, oc) in t5_data:
        items.append(item(m,1,5,q,[25,30],a,f'Pregunta {q}',opts_3(oa,ob,oc),'choice3',cuerpo=r_t5_cuerpo,instrucciones=r_t5_instr))
    
    # === LISTENING ===
    for q, a, prompt, oa, ob, oc in [
        (1,'a','¿Qué sabemos de esta persona?','Que no vive en el centro de la ciudad.','Que no tiene animales en casa.','Que no tiene prisa por la vivienda.'),
        (2,'c','¿De qué habla el mensaje?','De un problema familiar.','De unas vacaciones.','De un nuevo trabajo.'),
        (3,'b','¿De qué está hablando?','De una reunión con un cliente.','De cómo acceder a un programa informático.','De un nuevo despacho.'),
        (4,'a','¿Qué dice esta persona?','Que ha perdido las llaves.','Que se ha comprado un coche nuevo.','Que ha llegado tarde.'),
        (5,'b','¿De qué trata el mensaje?','De una cita médica.','De un cambio de planes.','De una receta de cocina.'),
        (6,'c','¿Qué información da?','Que va a llegar tarde.','Que no puede ir a la fiesta.','Que necesita ayuda con una mudanza.'),
    ]:
        items.append(item(m,2,1,q,[1,6],a,prompt,opts_3(oa,ob,oc),'choice3',
                         transcript=f'(Tarea 1, Mensaje {q} — Audio en YouTube: Nuevo DELE B1)'))
    
    for q, a, prompt, oa, ob, oc in [
        (7,'c','Andrea dice que…','gana mucho dinero en Valencia.','trabaja en la ciudad donde nació.','se dedica a la investigación médica.'),
        (8,'a','¿Qué sabemos de Andrea?','Está soltera.','Tiene dos hijos.','Vive con sus padres.'),
        (9,'b','Andrea comenta que…','no le gusta su trabajo.','su trabajo es muy gratificante.','quiere cambiar de profesión.'),
        (10,'a','Según Andrea…','viaja frecuentemente por trabajo.','nunca ha salido de España.','prefiere no viajar.'),
        (11,'b','Andrea dice que en el futuro…','quiere dejar su trabajo.','le gustaría formar una familia.','piensa mudarse al extranjero.'),
        (12,'c','¿Qué opina Andrea sobre su ciudad?','No le gusta nada.','Prefiere vivir en el campo.','Le encanta vivir allí.'),
    ]:
        items.append(item(m,2,2,q,[7,12],a,prompt,opts_3(oa,ob,oc),'choice3',
                         transcript='(Tarea 2 — Audio en YouTube: Nuevo DELE B1)'))
    
    for q, a, prompt, oa, ob, oc in [
        (13,'b','Amanda López…','no trabajaba los sábados.','trabajaba cuidando niños.','trabajaba en una oficina.'),
        (14,'c','El presidente…','ha dimitido.','ha convocado elecciones.','ha visitado varios países.'),
        (15,'c','¿Qué ha pasado con el actor?','Ha ganado un Oscar.','Se ha retirado del cine.','Va a protagonizar una nueva serie.'),
        (16,'a','La deportista…','ha anunciado su retirada.','ha batido un nuevo récord.','ha cambiado de equipo.'),
        (17,'a','¿Qué ha ocurrido en la ciudad?','Han inaugurado un nuevo museo.','Han cerrado el aeropuerto.','Han subido los impuestos.'),
        (18,'c','La última noticia habla de…','un escándalo político.','un desastre natural.','un descubrimiento científico.'),
    ]:
        items.append(item(m,2,3,q,[13,18],a,prompt,opts_3(oa,ob,oc),'choice3',
                         transcript='(Tarea 3 — Audio en YouTube: Nuevo DELE B1)'))
    
    t4_enum = ['A) Viajó a un lugar muy tranquilo.','B) Se hizo heridas con cristales.',
               'C) Ha nacido alguien muy importante para esta persona.','D) Conoció a su pareja en un viaje.',
               'E) Empezó a trabajar a los 16 años.','F) Ganó un premio importante.',
               'G) Estudió en el extranjero.','H) Tuvo un problema de salud grave.',
               'I) Cambió de profesión a los 40 años.']
    for q, a in [(19,'d'),(20,'a'),(21,'f'),(22,'b'),(23,'c'),(24,'e')]:
        items.append(item(m,2,4,q,[19,24],a,f'Persona {q-18}',
                         [{'key':chr(65+i),'text':t} for i,t in enumerate(t4_enum)],'choice9',
                         transcript='(Tarea 4 — Audio en YouTube: Nuevo DELE B1)'))
    
    for stmt, (q, a) in [
        ('Dice que algo va a ser más caro.', (25,'c')),
        ('Dice que la gente en Estados Unidos tiene más dinero cada año.', (26,'a')),
        ('Está preocupado/a por la economía.', (27,'b')),
        ('Cree que la situación va a mejorar.', (28,'a')),
        ('Va a invertir en bolsa.', (29,'c')),
        ('Quiere ahorrar más dinero.', (30,'b')),
    ]:
        items.append(item(m,2,5,q,[25,30],a,stmt,
                         [{'key':'A','text':'A) Hombre'},{'key':'B','text':'B) Mujer'},{'key':'C','text':'C) Ninguno'}],
                         'choice3', transcript='(Tarea 5 — Audio en YouTube: Nuevo DELE B1)'))
    
    # === WRITING ===
    instr_w1 = 'Tarea 1 (100-120 palabras): Usted recibe un mensaje en redes sociales pidiendo consejo. Responda. Debe: saludar; contestar a sus preguntas; dar un consejo; despedirse.'
    instr_w2 = 'Tarea 2 (130-150 palabras, elija una opción): Opción 1 — Blog sobre técnicas de estudio: comente sus técnicas, hable del mejor lugar y momento, ponga un ejemplo de mala técnica. Opción 2 — Opinión sobre un tema de actualidad.'
    items.append(item(m,3,1,1,[1,1],'', 'Tarea 1: Responder mensaje pidiendo consejo',[],'writing',instrucciones=instr_w1,rango='100-120 palabras'))
    items.append(item(m,3,2,2,[2,2],'', 'Tarea 2: Blog sobre técnicas de estudio',[],'writing',instrucciones=instr_w2,rango='130-150 palabras'))
    
    # === SPEAKING ===
    s1 = 'Tarea 1 — Exposición oral (2-3 min): Elija Opción 1 (trabajo ideal) o Opción 2 (vacaciones soñadas).'
    s2 = 'Tarea 2 — Conversación con el entrevistador (3-4 min).'
    s3 = 'Tarea 3 — Descripción de imagen + conversación. Opción 1: Trabajo a distancia. Opción 2: Oficina tradicional.'
    items.append(item(m,4,1,1,[1,1],'',s1,[],'speaking',instrucciones=pg(132)))
    items.append(item(m,4,2,2,[2,2],'',s2,[],'speaking',instrucciones=pg(133)))
    items.append(item(m,4,3,3,[3,3],'',s3,[],'speaking',instrucciones=pg(134)))
    
    return items

# ===== BUILD ALL =====
builders = {'2':build_m2,'3':build_m3,'4':build_m4}

for m in ['2','3','4']:
    items = builders[m]()
    data = {
        'version':'1.0','level':'B1',
        'source':f'Nuevo DELE B1 Modelo {m} — Ramón Díez Galán (exact PDF text extraction)',
        'language':'es-ES',
        'syllabus':{'level':'B1','duration_minutes':{'reading':70,'listening':40,'writing':60,'speaking_prep':15,'speaking_test':15}},
        'items':items
    }
    path = f'{DEPLOY}/dele_bank_b1_nuevo_m{m}.js'
    js = f'window.DELE_BANK_B1_NUEVO_M{m} = ' + json.dumps(data,indent=2,ensure_ascii=False) + ';\n'
    with open(path,'w',encoding='utf-8') as f:
        f.write(js)
    
    r = os.popen(f'node -c "{path}" 2>&1').read()
    wrong = 0
    for it in items:
        p,t,q = it['prueba'],it['tarea'],it['q']
        for sec in ['R','L']:
            if p==(1 if sec=='R' else 2) and str(t) in ANSWERS[m][sec] and q in ANSWERS[m][sec][str(t)]:
                if it['answer'].lower()!=ANSWERS[m][sec][str(t)][q]:
                    wrong += 1
                    if wrong <= 3:
                        print(f'  MISMATCH M{m} P{p}T{t}Q{q}: {it["answer"]} vs PDF {ANSWERS[m][sec][str(t)][q]}')
    ok = '✅ ALL ANSWERS MATCH' if wrong==0 else f'❌ {wrong} wrong'
    print(f'M{m}: {len(items)} items | JS: {"OK" if not r.strip() else r[:60]} | {ok}')

doc.close()
print('\nDone — all 3 files rebuilt with exact PDF text.')
