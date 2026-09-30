export type LegalSection = {
  title: string
  paragraphs: string[]
}

export type LegalDocument = {
  eyebrow: string
  title: string
  version: string
  effectiveDate: string
  intro: string
  sections: LegalSection[]
}

export const TERMS_OF_USE: LegalDocument = {
  eyebrow: 'Termos de uso',
  title: 'Termos de Uso da TriBusca',
  version: '1.0',
  effectiveDate: '30/09/2026',
  intro:
    'Estes Termos regulam o acesso e o uso da plataforma TriBusca. Ao criar uma conta, acessar ou utilizar o serviço, o usuário declara que leu e concorda com estas condições.',
  sections: [
    {
      title: '1. Sobre a TriBusca',
      paragraphs: [
        'A TriBusca é uma plataforma de monitoramento e inteligência tributária que coleta, organiza e apresenta informações provenientes de fontes oficiais, além de oferecer recursos de pesquisa, classificação, priorização, histórico e leitura auxiliar.',
        'A plataforma é uma ferramenta de apoio. Ela não substitui a legislação publicada pela autoridade competente, a consulta à fonte oficial, a avaliação profissional específica nem a responsabilidade do usuário pelas decisões fiscais, contábeis, jurídicas, operacionais ou sistêmicas tomadas com base nas informações apresentadas.',
      ],
    },
    {
      title: '2. Cadastro e conta',
      paragraphs: [
        'Para utilizar áreas autenticadas, o usuário deve fornecer informações corretas e atualizadas e manter suas credenciais sob confidencialidade. O titular da conta é responsável pelas atividades realizadas com suas credenciais, salvo quando houver falha de segurança atribuível à TriBusca.',
        'Contas empresariais podem conter uma ou mais empresas, estabelecimentos, perfis tributários e usuários autorizados. O acesso a esses dados é limitado às permissões associadas à conta e ao perfil de cada usuário.',
        'O usuário deve comunicar prontamente qualquer suspeita de acesso indevido, comprometimento de credenciais ou uso não autorizado.',
      ],
    },
    {
      title: '3. Período de teste, planos e acesso',
      paragraphs: [
        'Quando houver período de teste, o prazo, os limites e os recursos incluídos serão informados na própria plataforma. O encerramento do período de teste pode restringir recursos até que seja escolhido um plano disponível.',
        'Recursos, limites de uso, preços e condições comerciais aplicáveis a planos pagos serão apresentados antes da contratação ou da cobrança correspondente.',
      ],
    },
    {
      title: '4. Fontes oficiais e atualização das informações',
      paragraphs: [
        'A TriBusca realiza consultas automatizadas a fontes oficiais e procura preservar a origem, a URL oficial, a data de publicação e outros elementos de rastreabilidade. A disponibilidade, a estrutura e o conteúdo dessas fontes são controlados por terceiros e podem sofrer alterações, indisponibilidades ou atrasos.',
        'A ausência de uma publicação na TriBusca não significa, por si só, que não houve publicação oficial. Sempre que uma informação for material para uma obrigação, prazo ou decisão relevante, o usuário deve conferir a fonte oficial indicada.',
        'Em caso de divergência entre a TriBusca e o conteúdo oficial, prevalece o conteúdo publicado pela autoridade competente.',
      ],
    },
    {
      title: '5. Inteligência TriBusca e conteúdo gerado por IA',
      paragraphs: [
        'Classificações, marcadores, afinidade tributária, resumos, explicações e outras camadas de inteligência são recursos auxiliares e devem permanecer identificados de forma distinta do conteúdo oficial.',
        'Conteúdo gerado ou apoiado por inteligência artificial pode conter limitações, imprecisões ou interpretações incompletas. A TriBusca busca reduzir esses riscos, mas não garante que toda leitura auxiliar seja suficiente para resolver uma questão tributária concreta sem análise adicional.',
        'A plataforma não deve inventar impactos tributários quando os dados disponíveis não forem suficientes. Ainda assim, cabe ao usuário validar conclusões relevantes antes de agir.',
      ],
    },
    {
      title: '6. Uso permitido',
      paragraphs: [
        'O serviço deve ser usado para finalidades lícitas relacionadas a monitoramento, pesquisa, organização e análise de informações tributárias e legislativas.',
        'É proibido tentar acessar dados de outras contas, contornar controles de segurança, explorar vulnerabilidades, interferir no funcionamento da plataforma, realizar automações abusivas, copiar ou revender o serviço de forma não autorizada ou utilizá-lo para atividade ilícita.',
        'O usuário não deve enviar conteúdo que viole direitos de terceiros, normas aplicáveis ou obrigações de confidencialidade.',
      ],
    },
    {
      title: '7. Propriedade intelectual',
      paragraphs: [
        'A identidade visual, o software, a estrutura da plataforma, os modelos de organização, as taxonomias próprias, os componentes de interface e demais elementos desenvolvidos pela TriBusca são protegidos pela legislação aplicável e não podem ser reproduzidos ou explorados fora das permissões concedidas pelo serviço.',
        'Textos legais, atos oficiais e demais conteúdos de terceiros permanecem sujeitos ao regime jurídico e aos direitos aplicáveis à respectiva fonte. A TriBusca não reivindica autoria sobre conteúdo oficial produzido por órgãos públicos.',
      ],
    },
    {
      title: '8. Dados da conta e confidencialidade',
      paragraphs: [
        'Dados empresariais, perfis tributários, filtros, parâmetros e informações inseridas na conta são tratados para prestar e personalizar o serviço. A TriBusca não concede a outros clientes acesso a dados privados de uma conta.',
        'Cada parte deve preservar informações confidenciais a que tenha acesso em razão do uso ou da prestação do serviço, exceto quando a divulgação for autorizada, necessária à execução do serviço ou exigida por lei ou ordem válida.',
      ],
    },
    {
      title: '9. Disponibilidade, manutenção e serviços de terceiros',
      paragraphs: [
        'A TriBusca busca manter o serviço disponível e confiável, mas não garante operação ininterrupta. Manutenções, incidentes, indisponibilidades de provedores, mudanças em portais oficiais, bloqueios de acesso, falhas de rede ou eventos fora do controle razoável podem afetar temporariamente funcionalidades e coletas.',
        'Integrações com fontes oficiais, serviços de infraestrutura e outros fornecedores podem depender de condições e limitações impostas por terceiros.',
      ],
    },
    {
      title: '10. Suspensão e encerramento',
      paragraphs: [
        'A TriBusca pode suspender ou restringir o acesso quando houver risco de segurança, uso abusivo, tentativa de fraude, violação destes Termos, obrigação legal ou necessidade técnica relevante.',
        'O usuário pode solicitar encerramento da conta pelos canais disponibilizados pela TriBusca. O tratamento e a retenção dos dados após o encerramento seguirão a Política de Privacidade e as obrigações aplicáveis.',
      ],
    },
    {
      title: '11. Limitação de responsabilidade',
      paragraphs: [
        'Na extensão permitida pela legislação, a TriBusca não responde por decisões tomadas exclusivamente com base em leitura auxiliar sem validação da fonte oficial, por indisponibilidades ou alterações promovidas por terceiros, nem por consequências decorrentes de dados incorretos fornecidos pelo próprio usuário.',
        'Nada nestes Termos exclui responsabilidades que não possam ser legalmente afastadas.',
      ],
    },
    {
      title: '12. Alterações destes Termos',
      paragraphs: [
        'Estes Termos podem ser atualizados para refletir mudanças legais, de segurança, operacionais ou do serviço. A versão e a data de vigência serão identificadas no documento.',
        'Quando uma alteração exigir novo consentimento, a TriBusca poderá solicitar novo aceite antes da continuidade do uso de determinados recursos.',
      ],
    },
    {
      title: '13. Lei aplicável e contato',
      paragraphs: [
        'Estes Termos são regidos pelas leis da República Federativa do Brasil.',
        'Dúvidas, solicitações ou comunicações relacionadas a estes Termos podem ser encaminhadas pelos canais de atendimento disponibilizados pela TriBusca na plataforma ou no site.',
      ],
    },
  ],
}

export const PRIVACY_POLICY: LegalDocument = {
  eyebrow: 'Privacidade',
  title: 'Política de Privacidade da TriBusca',
  version: '1.0',
  effectiveDate: '30/09/2026',
  intro:
    'Esta Política explica como a TriBusca trata dados pessoais no cadastro, autenticação, uso da plataforma, atendimento e operação do serviço, em conformidade com a legislação brasileira aplicável, incluindo a Lei Geral de Proteção de Dados Pessoais (LGPD).',
  sections: [
    {
      title: '1. Quem trata os dados',
      paragraphs: [
        'A TriBusca atua como controladora dos dados pessoais necessários à criação e administração das contas, autenticação, segurança, relacionamento com usuários e operação do serviço.',
        'Em situações nas quais uma empresa cliente insere dados pessoais de terceiros para finalidades próprias, a definição de papéis e responsabilidades poderá depender do contexto e da relação contratual aplicável.',
      ],
    },
    {
      title: '2. Dados que podemos tratar',
      paragraphs: [
        'Podemos tratar dados de identificação e contato, como nome, e-mail profissional e informações da organização associada à conta.',
        'Também podemos tratar dados de autenticação e segurança, como identificadores de sessão, registros de acesso, endereço IP, tipo de navegador, data e hora de acesso, tentativas de autenticação e eventos necessários à prevenção de fraude e incidentes.',
        'Durante o uso do serviço, podem ser tratados dados empresariais, CNPJs, estabelecimentos, inscrições estaduais, CNAEs, perfis tributários, filtros, preferências e parâmetros cadastrados pelo usuário. Alguns desses dados podem ser públicos ou empresariais e outros podem conter dados pessoais, conforme o contexto.',
        'Podemos tratar comunicações enviadas ao suporte e informações técnicas produzidas durante o uso da plataforma.',
      ],
    },
    {
      title: '3. Para que usamos os dados',
      paragraphs: [
        'Utilizamos dados pessoais para criar e administrar contas, autenticar usuários, fornecer funcionalidades, personalizar a experiência, responder solicitações, manter histórico operacional, proteger a plataforma, detectar abuso, corrigir falhas e cumprir obrigações legais.',
        'Também podemos utilizar dados para medir desempenho, melhorar a qualidade do serviço e produzir estatísticas agregadas ou anonimizadas que não identifiquem diretamente o titular.',
      ],
    },
    {
      title: '4. Bases legais',
      paragraphs: [
        'O tratamento pode se apoiar, conforme a finalidade, na execução de contrato ou de procedimentos preliminares relacionados ao serviço, no cumprimento de obrigação legal ou regulatória, no exercício regular de direitos, em legítimo interesse compatível com os direitos do titular e, quando exigido, no consentimento.',
        'Quando o tratamento depender de consentimento, o titular poderá revogá-lo pelos meios disponibilizados, sem afetar tratamentos realizados anteriormente de forma legítima.',
      ],
    },
    {
      title: '5. Dados obtidos de fontes públicas e oficiais',
      paragraphs: [
        'A TriBusca consulta fontes públicas e oficiais para obter informações legislativas, cadastrais e operacionais necessárias ao serviço. Esses dados são tratados de acordo com a finalidade da plataforma e com as limitações legais aplicáveis.',
        'A origem oficial e a proveniência dos dados são preservadas sempre que isso fizer parte da funcionalidade.',
      ],
    },
    {
      title: '6. Compartilhamento e operadores',
      paragraphs: [
        'Podemos compartilhar dados com provedores que atuam em nosso nome para hospedar infraestrutura, armazenar dados, enviar comunicações, processar suporte, proteger o serviço ou executar outras funções necessárias à operação.',
        'Esses provedores recebem somente os dados necessários às respectivas finalidades e devem observar obrigações de segurança e confidencialidade compatíveis com o serviço contratado.',
        'Também podemos compartilhar dados quando necessário para cumprir lei, ordem judicial ou requisição válida de autoridade competente, proteger direitos ou investigar fraude e incidentes.',
        'A TriBusca não vende dados pessoais a anunciantes ou terceiros.',
      ],
    },
    {
      title: '7. Transferências internacionais',
      paragraphs: [
        'Alguns fornecedores de infraestrutura ou tecnologia podem processar dados em outros países. Quando isso ocorrer, adotaremos mecanismos e salvaguardas compatíveis com a legislação aplicável e com o nível de proteção exigido para o tratamento.',
      ],
    },
    {
      title: '8. Cookies, sessões e tecnologias semelhantes',
      paragraphs: [
        'A plataforma pode utilizar cookies estritamente necessários, identificadores de sessão e tecnologias equivalentes para autenticação, segurança, manutenção da sessão e funcionamento das preferências do usuário.',
        'Se forem adotadas tecnologias opcionais de medição, marketing ou personalização que exijam consentimento, o usuário receberá informação e controles apropriados antes do uso.',
      ],
    },
    {
      title: '9. Segurança',
      paragraphs: [
        'A TriBusca adota medidas técnicas e organizacionais destinadas a proteger os dados contra acesso não autorizado, alteração, perda, destruição ou divulgação indevida. Entre essas medidas podem estar controles de acesso, segregação lógica entre contas, registro de eventos, criptografia em trânsito e proteção das credenciais.',
        'Nenhum ambiente digital é imune a riscos. Caso seja identificado incidente relevante envolvendo dados pessoais, serão adotadas as medidas cabíveis de contenção, investigação e comunicação conforme a legislação aplicável.',
      ],
    },
    {
      title: '10. Retenção e eliminação',
      paragraphs: [
        'Os dados são mantidos pelo período necessário para cumprir as finalidades desta Política, prestar o serviço, preservar segurança e auditoria, exercer direitos e atender obrigações legais ou regulatórias.',
        'Após o encerramento da conta ou o término da finalidade, os dados poderão ser eliminados, anonimizados ou mantidos pelo período necessário quando houver base legal para a retenção.',
      ],
    },
    {
      title: '11. Direitos dos titulares',
      paragraphs: [
        'Nos termos da LGPD, o titular pode solicitar, quando aplicável, confirmação da existência de tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade, portabilidade nos termos da regulamentação, informação sobre compartilhamentos, revogação do consentimento e revisão de decisões automatizadas nos casos previstos em lei.',
        'A TriBusca poderá solicitar informações adicionais para confirmar a identidade do solicitante e proteger os dados contra pedidos indevidos.',
      ],
    },
    {
      title: '12. Dados de crianças e adolescentes',
      paragraphs: [
        'A TriBusca é destinada ao uso profissional e empresarial e não é direcionada intencionalmente a crianças. Contas devem ser criadas por pessoas com capacidade para aceitar os termos aplicáveis ao serviço.',
      ],
    },
    {
      title: '13. Atualizações e contato',
      paragraphs: [
        'Esta Política pode ser atualizada para refletir mudanças legais, tecnológicas ou operacionais. A versão e a data de vigência serão sempre identificadas.',
        'Solicitações relacionadas a privacidade e proteção de dados podem ser encaminhadas pelos canais de atendimento disponibilizados pela TriBusca na plataforma ou no site.',
      ],
    },
  ],
}
